package br.com.vetorurbano.api.occurrences;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Read of one record by identifier. A withdrawn record answers only with unavailability and the moment
 * of the withdrawal: the contaminated content is never sent again, and the address keeps explaining
 * itself instead of silently becoming an unrelated page.
 */
public final class OccurrenceLookup {
    private OccurrenceLookup(){}

    public static Map<String,Object> unavailable(String id,java.time.Instant withdrawnAt){
        var result=new LinkedHashMap<String,Object>();
        result.put("id",id);
        result.put("status","UNAVAILABLE");
        result.put("unavailable",true);
        result.put("withdrawnAt",withdrawnAt);
        result.put("message","Registro indisponível: o conteúdo foi retirado após revisão administrativa. Consulte a consulta principal para os registros vigentes.");
        return result;
    }

    public static Map<String,Object> published(OccurrenceRecord record){
        var result=new LinkedHashMap<String,Object>();
        result.put("id",record.id());
        result.put("status","PUBLISHED");
        result.put("unavailable",false);
        result.put("occurrence",OccurrenceView.from(record));
        return result;
    }
}
