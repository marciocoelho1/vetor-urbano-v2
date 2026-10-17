package br.com.vetorurbano.api.moderation;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.*;
import br.com.vetorurbano.api.corrections.CorrectionService;

/** Server-owned mandatory publication core. Unknown detail never becomes zero or a guessed point. */
public record PublicationDraft(String title,String description,String category,String type,String subtype,
        String situation,int reliability,String municipality,String neighborhood,String precision,
        Double longitude,Double latitude,Instant at,Instant from,Instant until) {
    private static final Map<String,String> CATEGORY=Map.ofEntries(
        Map.entry("ROUBO","SEGURANCA"),Map.entry("FURTO","SEGURANCA"),Map.entry("DISPAROS","SEGURANCA"),Map.entry("OPERACAO_POLICIAL","SEGURANCA"),Map.entry("CONFRONTO","SEGURANCA"),
        Map.entry("ACIDENTE","TRANSITO"),Map.entry("INTERDICAO","TRANSITO"),Map.entry("CONGESTIONAMENTO","TRANSITO"),Map.entry("OBRAS","TRANSITO"),Map.entry("SEMAFOROS","TRANSITO"),
        Map.entry("ALAGAMENTO","CONTINGENCIA"),Map.entry("DESLIZAMENTO","CONTINGENCIA"),Map.entry("INCENDIO","CONTINGENCIA"),Map.entry("ARVORE","CONTINGENCIA"),Map.entry("ENERGIA","CONTINGENCIA"),Map.entry("AGUA","CONTINGENCIA"));
    private static final Map<String,Set<String>> SUBTYPES=Map.of(
        "ROUBO",Set.of("A_PEDESTRE","DE_VEICULO","DE_CARGA","A_ESTABELECIMENTO","A_RESIDENCIA","EM_TRANSPORTE_COLETIVO"),
        "FURTO",Set.of("DE_OBJETOS_PESSOAIS","DE_VEICULO","DE_CARGA","EM_ESTABELECIMENTO","EM_RESIDENCIA"),
        "ACIDENTE",Set.of("COLISAO","ENGAVETAMENTO","ATROPELAMENTO","CAPOTAMENTO","TOMBAMENTO","QUEDA_DE_MOTOCICLISTA_OU_CICLISTA"),
        "INTERDICAO",Set.of("TOTAL","PARCIAL"),"INCENDIO",Set.of("EM_EDIFICACAO","EM_VEGETACAO","EM_VEICULO","EM_OUTRO_LOCAL_INFORMADO"));
    private static final Set<String> FIELDS=Set.of("title","description","category","type","subtype","situation","reliability","municipality","neighborhood","locationPrecision","longitude","latitude","occurredAt","occurredFrom","occurredUntil");
    public static PublicationDraft parse(Map<String,Object> body){
        if(!FIELDS.containsAll(body.keySet()))throw CorrectionService.invalid("Campo factual não declarado.");
        String title=text(body,"title",200),description=text(body,"description",8000),category=text(body,"category",30),type=text(body,"type",80),subtype=text(body,"subtype",100),situation=text(body,"situation",20),municipality=text(body,"municipality",150),neighborhood=optionalNeighborhood(body),precision=text(body,"locationPrecision",20);
        if(!category.equals(CATEGORY.get(type))||!Set.of("ONGOING","CLOSED","UNKNOWN").contains(situation)||!subtype.equals("NAO_INFORMADO")&&!SUBTYPES.getOrDefault(type,Set.of()).contains(subtype))throw CorrectionService.invalid("Catálogo ou situação inválidos.");
        int reliability=integer(body,"reliability");if(reliability<1||reliability>5)throw CorrectionService.invalid("Nota deve estar entre 1 e 5; não substitui evidência.");
        Double lon=coordinate(body,"longitude"),lat=coordinate(body,"latitude");
        if(precision.equals("POINT")) {if(lon==null||lat==null||lon< -180||lon>180||lat< -90||lat>90)throw CorrectionService.invalid("Informe coordenadas sustentadas.");}
        else if(!precision.equals("TERRITORY")||lon!=null||lat!=null)throw CorrectionService.invalid("Precisão territorial não recebe ponto inventado.");
        Instant at=instant(body,"occurredAt"),from=instant(body,"occurredFrom"),until=instant(body,"occurredUntil");
        if(!(at!=null&&from==null&&until==null||at==null&&from!=null&&until!=null&&from.isBefore(until)))throw CorrectionService.invalid("Data ou intervalo sustentado é obrigatório.");
        return new PublicationDraft(title,description,category,type,subtype,situation,reliability,municipality,neighborhood,precision,lon,lat,at,from,until);
    }
    private static String optionalNeighborhood(Map<String,Object> body){
        Object value=body.get("neighborhood");if(value==null||value instanceof String text&&text.isBlank())return "Não informado";
        return text(body,"neighborhood",150);
    }
    public static String text(Map<String,Object> body,String key,int max){if(!(body.get(key) instanceof String value)||value.isBlank()||value.length()>max)throw CorrectionService.invalid("Revise "+key+".");return value.strip();}
    public static int integer(Map<String,Object> body,String key){if(!(body.get(key) instanceof Number value)||value.doubleValue()!=value.intValue()||value.intValue()<1)throw CorrectionService.invalid("Número inválido: "+key);return value.intValue();}
    private static Double coordinate(Map<String,Object> body,String key){Object raw=body.get(key);if(raw==null)return null;if(!(raw instanceof Number number)||!Double.isFinite(number.doubleValue()))throw CorrectionService.invalid("Coordenada inválida.");return number.doubleValue();}
    private static Instant instant(Map<String,Object> body,String key){Object raw=body.get(key);if(raw==null||raw.equals(""))return null;try{return Instant.parse((String)raw);}catch(DateTimeParseException|ClassCastException ex){throw CorrectionService.invalid("Instante UTC inválido: "+key);}}
}
