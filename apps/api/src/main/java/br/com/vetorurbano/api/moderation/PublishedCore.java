package br.com.vetorurbano.api.moderation;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.*;
import br.com.vetorurbano.api.corrections.CorrectionService;

/**
 * Server-owned validation of a prepared change. The proposed core is merged over the current published
 * record and every invariant that applies at publication time is re-checked, so an approval can never
 * leave the catalogue, precision or temporal rules in an invalid state. Nothing is inferred: a missing
 * key keeps the published value, and a key sent without a sustained value is refused.
 */
final class PublishedCore {
    private static final Set<String> FIELDS=Set.of("title","description","category","type","subtype","situation","reliability","municipality","neighborhood","locationPrecision","longitude","latitude","occurredAt","occurredFrom","occurredUntil");
    private static final Set<String> TYPES=Set.of("ROUBO","FURTO","DISPAROS","OPERACAO_POLICIAL","CONFRONTO","ACIDENTE","INTERDICAO","CONGESTIONAMENTO","OBRAS","SEMAFOROS","ALAGAMENTO","DESLIZAMENTO","INCENDIO","ARVORE","ENERGIA","AGUA");
    /** Types whose pillar is accepted both in the published catalogue and in the moderation catalogue. */
    private static final Map<String,Set<String>> CATEGORIES=Map.ofEntries(
        Map.entry("ROUBO",Set.of("SEGURANCA")),Map.entry("FURTO",Set.of("SEGURANCA")),Map.entry("DISPAROS",Set.of("SEGURANCA")),
        Map.entry("OPERACAO_POLICIAL",Set.of("SEGURANCA")),Map.entry("CONFRONTO",Set.of("SEGURANCA")),
        Map.entry("ACIDENTE",Set.of("TRANSITO")),Map.entry("CONGESTIONAMENTO",Set.of("TRANSITO")),Map.entry("OBRAS",Set.of("TRANSITO")),
        Map.entry("SEMAFOROS",Set.of("TRANSITO")),Map.entry("INTERDICAO",Set.of("TRANSITO","CONTINGENCIA")),
        Map.entry("ALAGAMENTO",Set.of("CONTINGENCIA")),Map.entry("DESLIZAMENTO",Set.of("CONTINGENCIA")),Map.entry("INCENDIO",Set.of("CONTINGENCIA")),
        Map.entry("ARVORE",Set.of("CONTINGENCIA")),Map.entry("ENERGIA",Set.of("CONTINGENCIA")),Map.entry("AGUA",Set.of("CONTINGENCIA")));
    private static final Map<String,Set<String>> SUBTYPES=Map.of(
        "ROUBO",Set.of("A_PEDESTRE","DE_VEICULO","DE_CARGA","A_ESTABELECIMENTO","A_RESIDENCIA","EM_TRANSPORTE_COLETIVO"),
        "FURTO",Set.of("DE_OBJETOS_PESSOAIS","DE_VEICULO","DE_CARGA","EM_ESTABELECIMENTO","EM_RESIDENCIA"),
        "ACIDENTE",Set.of("COLISAO","ENGAVETAMENTO","ATROPELAMENTO","CAPOTAMENTO","TOMBAMENTO","QUEDA_DE_MOTOCICLISTA_OU_CICLISTA"),
        "INTERDICAO",Set.of("TOTAL","PARCIAL"),"INCENDIO",Set.of("EM_EDIFICACAO","EM_VEGETACAO","EM_VEICULO","EM_OUTRO_LOCAL_INFORMADO"));
    private PublishedCore(){}

    /** Validates the whole proposed record and returns the merged values that an approval would write. */
    static Map<String,Object> validate(Map<String,Object> proposed,Map<String,Object> current){
        if(!FIELDS.containsAll(proposed.keySet()))throw CorrectionService.invalid("Campo factual não declarado.");
        Map<String,Object> effective=new LinkedHashMap<>();
        for(String key:FIELDS)effective.put(key,proposed.containsKey(key)?proposed.get(key):publishedValue(current,key));
        text(effective,"title",200);text(effective,"description",8000);text(effective,"municipality",150);
        String type=text(effective,"type",80),subtype=text(effective,"subtype",100),situation=text(effective,"situation",20),category=text(effective,"category",30),precision=text(effective,"locationPrecision",20);
        // An already published pair stays readable; a new pillar must match the moderation catalogue.
        boolean publishedPair=current.get("category").equals(category)&&current.get("occurrence_type").equals(type);
        if(!TYPES.contains(type)||!publishedPair&&!CATEGORIES.getOrDefault(type,Set.of()).contains(category))throw CorrectionService.invalid("Catálogo incompatível: tipo e categoria publicada não coincidem.");
        if(!subtype.equals("NAO_INFORMADO")&&!SUBTYPES.getOrDefault(type,Set.of()).contains(subtype))throw CorrectionService.invalid("Subtipo incompatível com o tipo.");
        if(!Set.of("ONGOING","CLOSED","UNKNOWN").contains(situation))throw CorrectionService.invalid("Situação operacional inválida.");
        Integer reliability=number(effective,"reliability");
        if(reliability==null||reliability<1||reliability>5)throw CorrectionService.invalid("Nota deve estar entre 1 e 5; não substitui evidência.");
        Double longitude=coordinate(effective,"longitude"),latitude=coordinate(effective,"latitude");
        if(precision.equals("POINT")){
            if(longitude==null||latitude==null||longitude< -180||longitude>180||latitude< -90||latitude>90)throw CorrectionService.invalid("Ponto corrigido exige coordenadas sustentadas.");
        }else if(!precision.equals("TERRITORY")||longitude!=null||latitude!=null)throw CorrectionService.invalid("Precisão territorial não recebe ponto inventado.");
        Instant at=instant(effective,"occurredAt"),from=instant(effective,"occurredFrom"),until=instant(effective,"occurredUntil");
        if(!(at!=null&&from==null&&until==null||at==null&&from!=null&&until!=null&&from.isBefore(until)))throw CorrectionService.invalid("Data ou intervalo UTC sustentado é obrigatório.");
        String neighborhood=optional(effective.get("neighborhood"));
        effective.put("neighborhood",neighborhood==null?"Não informado":neighborhood);
        return effective;
    }

    /** A preparation must move at least one published field; an identical proposal changes nothing. */
    static boolean unchanged(Map<String,Object> proposed,Map<String,Object> current,Map<String,Object> effective){
        for(String key:proposed.keySet())
            if(!Objects.equals(effective.get(key),publishedValue(current,key)))return false;
        return true;
    }

    /** Detached copy of a stored JSONB proposal, so validating a decision never mutates the document. */
    static Map<String,Object> proposed(Map<String,Object> changes){return new LinkedHashMap<>(changes);}

    private static Object publishedValue(Map<String,Object> current,String key){
        return switch(key){
            case "type" -> current.get("occurrence_type");
            case "reliability" -> current.get("reliability_score");
            case "locationPrecision" -> current.get("location_precision");
            case "longitude" -> current.get("longitude");
            case "latitude" -> current.get("latitude");
            case "occurredAt" -> current.get("occurred_at");
            case "occurredFrom" -> current.get("occurred_from");
            case "occurredUntil" -> current.get("occurred_until");
            default -> current.get(key);
        };
    }
    private static String text(Map<String,Object> effective,String key,int max){
        Object value=effective.get(key);
        if(!(value instanceof String item)||item.strip().isEmpty()||item.strip().length()>max)throw CorrectionService.invalid("Revise "+key+".");
        return item.strip();
    }
    private static String optional(Object value){
        if(value==null)return null;
        if(!(value instanceof String item))throw CorrectionService.invalid("Bairro deve ser texto; bairro desconhecido permanece explícito.");
        return item.strip().isEmpty()?null:item.strip();
    }
    private static Integer number(Map<String,Object> effective,String key){
        Object value=effective.get(key);
        if(value instanceof Number number)return number.intValue();
        if(value instanceof String item&&item.matches("-?\\d+"))return Integer.valueOf(item);
        throw CorrectionService.invalid("Número inválido: "+key);
    }
    private static Double coordinate(Map<String,Object> effective,String key){
        Object value=effective.get(key);if(value==null)return null;
        if(value instanceof Number number&&Double.isFinite(number.doubleValue()))return number.doubleValue();
        throw CorrectionService.invalid("Coordenada inválida: "+key);
    }
    private static Instant instant(Map<String,Object> effective,String key){
        Object value=effective.get(key);
        if(value==null||value instanceof String text&&text.isBlank())return null;
        if(value instanceof java.sql.Timestamp stamp)return stamp.toInstant();
        if(value instanceof java.util.Date date)return date.toInstant();
        try{return Instant.parse(value.toString());}
        catch(DateTimeParseException first){
            try{return java.time.OffsetDateTime.parse(value.toString()).toInstant();}
            catch(DateTimeParseException second){throw CorrectionService.invalid("Instante UTC inválido: "+key);}
        }
    }
}
