package br.com.vetorurbano.api.moderation;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import br.com.vetorurbano.api.corrections.CorrectionService;

@Service
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class ReviewService {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final JdbcTemplate jdbc;private final Clock clock;private final PublicationStore publications;
    public ReviewService(JdbcTemplate jdbc,Clock clock,PublicationStore publications){this.jdbc=jdbc;this.clock=clock;this.publications=publications;}
    public Object queue(String priority,String order,UUID actor){
        if(priority!=null&&!Set.of("HIGH","NORMAL","PLANNED").contains(priority)||order!=null&&!Set.of("priority","wait").contains(order))throw CorrectionService.invalid("Filtro de fila inválido.");
        publications.audit(actor,"REVIEW_QUEUE_READ","queue");
        String sorting="wait".equals(order)?"r.queued_at,r.clipping_id":"CASE r.priority WHEN 'HIGH' THEN 0 WHEN 'NORMAL' THEN 1 ELSE 2 END,r.queued_at,r.clipping_id";
        var rows=jdbc.queryForList("SELECT r.*,c.reference,c.title AS clipping_title,c.source_id,c.source_published_at,greatest(0,extract(epoch FROM (?::timestamptz-r.queued_at)))::bigint AS waiting_seconds FROM clipping_reviews r JOIN clippings c ON c.id=r.clipping_id WHERE r.state='PENDING' AND (?::text IS NULL OR r.priority=?) ORDER BY "+sorting,Timestamp.from(clock.instant()),priority,priority);
        rows.forEach(row->{row.remove("occurrence_ids");row.put("extracted",JSON.readTree(row.get("extracted").toString()));});
        return Map.of("items",rows);
    }
    public Object options(UUID actor){publications.audit(actor,"REVIEW_OPTIONS_READ","options");return Map.of("occurrences",jdbc.queryForList("SELECT id,title,happening_id,revision FROM occurrences WHERE publication_status='PUBLISHED' ORDER BY id"),"happenings",jdbc.queryForList("SELECT id,title FROM happenings ORDER BY id"));}
    public Object history(String id,UUID actor){publications.audit(actor,"REVIEW_HISTORY_READ",id);return jdbc.queryForList("SELECT revision,action,reason,command::text,before_snapshot::text,after_snapshot::text,author_id,historical_actor_id,occurred_at FROM clipping_review_decisions WHERE clipping_id=? ORDER BY revision",id);}
    @Transactional public Object decide(String id,Map<String,Object> body,UUID actor){
        if(!Set.of("decisionKey","expectedVersion","action","reason","draft","happeningId","happeningTitle","occurrenceId","expectedOccurrenceVersion","conflictResolution","additionalEffects").containsAll(body.keySet()))throw CorrectionService.invalid("Campos da decisão inválidos.");
        UUID key;try{key=UUID.fromString(PublicationDraft.text(body,"decisionKey",36));}catch(IllegalArgumentException ex){throw CorrectionService.invalid("Chave de decisão inválida.");}
        // Serializes identical keys even if a caller erroneously submits them for different clippings.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?::text,0))",key.toString());
        var rows=jdbc.queryForList("SELECT * FROM clipping_reviews WHERE clipping_id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Clipping indisponível.");
        String command=JSON.writeValueAsString(body);
        var prior=jdbc.queryForList("SELECT clipping_id,command=?::jsonb AS same,after_snapshot::text AS result FROM clipping_review_decisions WHERE decision_key=?",command,key);
        if(!prior.isEmpty()){
            if(!prior.getFirst().get("clipping_id").equals(id)||!Boolean.TRUE.equals(prior.getFirst().get("same")))throw conflict("Chave já usada para outra decisão.");
            return JSON.readTree((String)prior.getFirst().get("result"));
        }
        var review=rows.getFirst();int revision=(Integer)review.get("revision");
        if(PublicationDraft.integer(body,"expectedVersion")!=revision||!review.get("state").equals("PENDING"))throw conflict("Clipping mudou; recarregue para preservar a decisão.");
        String action=PublicationDraft.text(body,"action",20),reason=PublicationDraft.text(body,"reason",2000);
        if(!Set.of("CREATE","ASSOCIATE","PENDING","DISMISS").contains(action))throw CorrectionService.invalid("Decisão inválida.");
        String before=reviewSnapshot(id),occurrence=null,state="PENDING";
        var occurrenceIds=new ArrayList<String>();
        if(body.containsKey("additionalEffects")&&!action.equals("CREATE"))throw CorrectionService.invalid("Efeitos adicionais exigem criação explícita de efeitos relacionados.");
        if(Set.of("CREATE","ASSOCIATE").contains(action)){
            String reference=jdbc.queryForObject("SELECT reference FROM clippings WHERE id=?",String.class,id);
            if(reference==null||reference.isBlank())throw CorrectionService.invalid("Referência rastreável obrigatória.");
            if(Boolean.TRUE.equals(review.get("essential_conflict")))PublicationDraft.text(body,"conflictResolution",2000);
            if(action.equals("CREATE")){
                var drafts=new ArrayList<PublicationDraft>();drafts.add(PublicationDraft.parse(draft(body)));
                if(body.containsKey("additionalEffects")){
                    if(!(body.get("additionalEffects") instanceof List<?> effects))throw CorrectionService.invalid("Lista de efeitos inválida.");
                    for(var effect:effects){if(!(effect instanceof Map<?,?>))throw CorrectionService.invalid("Efeito sem núcleo factual.");
                        @SuppressWarnings("unchecked") var factual=(Map<String,Object>)effect;drafts.add(PublicationDraft.parse(factual));}
                }
                String happening;
                if(body.containsKey("happeningId")&&!body.containsKey("happeningTitle")){
                    happening=PublicationDraft.text(body,"happeningId",200);
                    if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM happenings WHERE id=?)",Boolean.class,happening)))throw CorrectionService.invalid("Acontecimento deve ser explicitamente escolhido.");
                }else if(body.containsKey("happeningTitle")&&!body.containsKey("happeningId")){
                    happening=UUID.randomUUID().toString();String title=PublicationDraft.text(body,"happeningTitle",200);
                    jdbc.update("INSERT INTO happenings(id,title,description) VALUES(?,?,?)",happening,title,"Contexto criado por revisão humana: "+reason);
                }else throw CorrectionService.invalid("Escolha acontecimento existente ou crie contexto explicitamente.");
                for(var draft:drafts){
                    String effectId=UUID.randomUUID().toString();publications.create(effectId,happening,draft);
                    jdbc.update("INSERT INTO occurrence_clippings(occurrence_id,clipping_id) VALUES(?,?)",effectId,id);
                    publications.record(effectId,null,"PUBLISHED",reason,actor);occurrenceIds.add(effectId);
                }
                occurrence=occurrenceIds.getFirst();
            }else{
                occurrence=PublicationDraft.text(body,"occurrenceId",200);
                var current=jdbc.queryForList("SELECT revision,publication_status FROM occurrences WHERE id=? FOR UPDATE",occurrence);
                if(current.isEmpty()||!current.getFirst().get("publication_status").equals("PUBLISHED"))throw CorrectionService.invalid("Associação exige ocorrência publicada.");
                if(PublicationDraft.integer(body,"expectedOccurrenceVersion")!=(Integer)current.getFirst().get("revision"))throw conflict("Ocorrência mudou; revise a associação.");
                String old=publications.snapshot(occurrence);
                jdbc.update("INSERT INTO occurrence_clippings(occurrence_id,clipping_id) VALUES(?,?) ON CONFLICT DO NOTHING",occurrence,id);
                jdbc.update("UPDATE occurrences SET revision=revision+1 WHERE id=?",occurrence);
                publications.record(occurrence,old,"ASSOCIATED",reason,actor);occurrenceIds.add(occurrence);
            }
            state="APPROVED";
        }else if(action.equals("DISMISS"))state="DISMISSED";
        jdbc.update("UPDATE clipping_reviews SET revision=revision+1,state=?,reason=?,occurrence_id=?,occurrence_ids=?::text[],essential_conflict=CASE WHEN ?='APPROVED' THEN false ELSE essential_conflict END WHERE clipping_id=?",state,reason,occurrence,"{"+String.join(",",occurrenceIds)+"}",state,id);
        String after=reviewSnapshot(id);
        jdbc.update("INSERT INTO clipping_review_decisions(decision_key,clipping_id,revision,action,reason,command,before_snapshot,after_snapshot,author_id,occurred_at) VALUES(?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?,?)",key,id,revision+1,action,reason,command,before,after,actor,Timestamp.from(clock.instant()));
        publications.audit(actor,"CLIPPING_"+action,id);return JSON.readTree(after);
    }
    @SuppressWarnings("unchecked") static Map<String,Object> draft(Map<String,Object> body){if(!(body.get("draft") instanceof Map<?,?> map))throw CorrectionService.invalid("Núcleo factual obrigatório.");return (Map<String,Object>)map;}
    private String reviewSnapshot(String id){return jdbc.queryForObject("SELECT to_jsonb(r)::text FROM clipping_reviews r WHERE clipping_id=?",String.class,id);}
    static ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}
}
