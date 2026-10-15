package br.com.vetorurbano.api.occurrences;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;

@Component
public class OccurrenceQueryParser {
    private static final Set<String> ALLOWED_PARAMETERS = Set.of(
            "periodStart",
            "periodEnd",
            "category",
            "type",
            "subtype",
            "municipality",
            "neighborhood",
            "sourceId",
            "text",
            "minReliability",
            "maxReliability",
            "situation",
            "longitude",
            "latitude",
            "radiusMeters", "timeStart", "timeEnd", "west", "south", "east", "north");

    public OccurrenceQuery parse(MultiValueMap<String, String> parameters) {
        rejectUnknownParameters(parameters);

        boolean ongoingOnly = values(parameters, "situation").equals(List.of("ONGOING"));
        boolean withoutPeriod = !parameters.containsKey("periodStart") && !parameters.containsKey("periodEnd");
        var periodStart = ongoingOnly && withoutPeriod ? null : requiredInstant(parameters, "periodStart");
        var periodEnd = ongoingOnly && withoutPeriod ? null : requiredInstant(parameters, "periodEnd");
        if (periodStart != null && !periodStart.isBefore(periodEnd)) {
            throw invalid("periodStart precisa ser anterior a periodEnd.");
        }

        var categories = values(parameters, "category").stream()
                .map(OccurrenceQueryParser::category)
                .distinct()
                .toList();
        var types = values(parameters, "type").stream()
                .map(value -> identifier(value, "type"))
                .distinct()
                .toList();
        var subtypes = values(parameters, "subtype").stream()
                .map(value -> identifier(value, "subtype"))
                .distinct()
                .toList();
        var municipalities = values(parameters, "municipality").stream()
                .map(value -> label(value, "municipality"))
                .distinct()
                .toList();
        var neighborhoods = values(parameters, "neighborhood").stream()
                .map(value -> label(value, "neighborhood"))
                .distinct()
                .toList();
        var sourceIds = values(parameters, "sourceId").stream()
                .map(value -> identifier(value, "sourceId"))
                .distinct()
                .toList();
        var situations = values(parameters, "situation").stream()
                .map(OccurrenceQueryParser::situation)
                .distinct()
                .toList();

        var text = optionalSingle(parameters, "text");
        if (text != null) {
            text = text.strip();
            if (text.isEmpty() || text.length() > 200) {
                throw invalid("text precisa ter entre 1 e 200 caracteres.");
            }
        }

        var minReliability = optionalInteger(parameters, "minReliability");
        var maxReliability = optionalInteger(parameters, "maxReliability");
        validateReliability(minReliability, "minReliability");
        validateReliability(maxReliability, "maxReliability");
        if (minReliability != null && maxReliability != null && minReliability > maxReliability) {
            throw invalid("minReliability não pode ser maior que maxReliability.");
        }

        var longitudeValue = optionalSingle(parameters, "longitude");
        var latitudeValue = optionalSingle(parameters, "latitude");
        if ((longitudeValue == null) != (latitudeValue == null)) {
            throw invalid("longitude e latitude precisam ser informadas juntas.");
        }

        Coordinates center = null;
        if (longitudeValue != null) {
            try {
                center = new Coordinates(
                        parseDouble(longitudeValue, "longitude"),
                        parseDouble(latitudeValue, "latitude"));
            } catch (IllegalArgumentException exception) {
                throw invalid("longitude ou latitude está fora dos limites WGS 84.");
            }
        }

        var radiusMeters = optionalInteger(parameters, "radiusMeters");
        if (radiusMeters != null) {
            if (center == null) {
                throw invalid("radiusMeters exige longitude e latitude.");
            }
            if (radiusMeters < 100 || radiusMeters > 25_000) {
                throw invalid("radiusMeters precisa estar entre 100 e 25000 metros.");
            }
        }

        var timeStart = optionalTime(parameters, "timeStart");
        var timeEnd = optionalTime(parameters, "timeEnd");
        var bounds = new java.util.ArrayList<Double>();
        for (var key : List.of("west", "south", "east", "north")) {
            var value = optionalSingle(parameters, key);
            if (value != null) bounds.add(parseDouble(value, key));
        }
        if (!bounds.isEmpty()) {
            if (bounds.size() != 4 || bounds.stream().anyMatch(value -> !Double.isFinite(value))
                    || bounds.get(0) < -180 || bounds.get(2) > 180
                    || bounds.get(1) < -90 || bounds.get(3) > 90
                    || bounds.get(0) >= bounds.get(2) || bounds.get(1) >= bounds.get(3)) {
                throw invalid("O recorte exige west/south/east/north válidos em WGS 84.");
            }
        }

        return new OccurrenceQuery(
                periodStart,
                periodEnd,
                categories,
                types,
                subtypes,
                municipalities,
                neighborhoods,
                sourceIds,
                text,
                minReliability,
                maxReliability,
                situations,
                center,
                radiusMeters, timeStart, timeEnd, bounds);
    }

    private static String optionalTime(MultiValueMap<String, String> parameters, String name) {
        var value = optionalSingle(parameters, name);
        if (value != null && !value.matches("([01][0-9]|2[0-3]):[0-5][0-9]")) {
            throw invalid(name + " precisa estar no formato HH:mm.");
        }
        return value;
    }

    private static void rejectUnknownParameters(MultiValueMap<String, String> parameters) {
        for (var name : parameters.keySet()) {
            if (!ALLOWED_PARAMETERS.contains(name)) {
                throw invalid("Parâmetro de consulta desconhecido.");
            }
        }
    }

    private static java.time.Instant requiredInstant(
            MultiValueMap<String, String> parameters,
            String name) {
        var value = requiredSingle(parameters, name);
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException exception) {
            throw invalid(name + " precisa ser uma data RFC 3339 com fuso explícito.");
        }
    }

    private static String category(String value) {
        try {
            return OccurrenceCategory.valueOf(value).name();
        } catch (IllegalArgumentException exception) {
            throw invalid("category contém um valor desconhecido.");
        }
    }

    private static String situation(String value) {
        try {
            return OccurrenceSituation.valueOf(value).name();
        } catch (IllegalArgumentException exception) {
            throw invalid("situation contém um valor desconhecido.");
        }
    }

    private static String identifier(String value, String name) {
        if (value.length() > 100 || !value.matches("[A-Za-z0-9_:-]+")) {
            throw invalid(name + " contém um identificador inválido.");
        }
        return value;
    }

    private static String label(String value, String name) {
        var normalized = value.strip();
        if (normalized.isEmpty() || normalized.length() > 150) {
            throw invalid(name + " precisa ter entre 1 e 150 caracteres.");
        }
        return normalized;
    }

    private static List<String> values(MultiValueMap<String, String> parameters, String name) {
        var values = parameters.get(name);
        if (values == null) {
            return List.of();
        }
        if (values.size() > 50 || values.stream().anyMatch(value -> value == null || value.isBlank())) {
            throw invalid(name + " contém valores vazios ou em excesso.");
        }
        return values;
    }

    private static String requiredSingle(MultiValueMap<String, String> parameters, String name) {
        var value = optionalSingle(parameters, name);
        if (value == null || value.isBlank()) {
            throw invalid(name + " é obrigatório.");
        }
        return value;
    }

    private static String optionalSingle(MultiValueMap<String, String> parameters, String name) {
        var values = parameters.get(name);
        if (values == null) {
            return null;
        }
        if (values.size() != 1) {
            throw invalid(name + " deve ser informado uma única vez.");
        }
        return values.getFirst();
    }

    private static Integer optionalInteger(MultiValueMap<String, String> parameters, String name) {
        var value = optionalSingle(parameters, name);
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException exception) {
            throw invalid(name + " precisa ser um número inteiro.");
        }
    }

    private static void validateReliability(Integer value, String name) {
        if (value != null && (value < 1 || value > 5)) {
            throw invalid(name + " precisa estar entre 1 e 5.");
        }
    }

    private static double parseDouble(String value, String name) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException exception) {
            throw invalid(name + " precisa ser um número decimal.");
        }
    }

    private static InvalidQueryException invalid(String message) {
        return new InvalidQueryException(message);
    }
}
