package br.com.vetorurbano.api.moderation;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import br.com.vetorurbano.api.corrections.CorrectionService;

/**
 * Ticket 18: prepares a correction of an already published synthetic occurrence and withdraws
 * compromised content without erasing internal history. A preparation never changes what the common
 * query reads; only an explicit approval appends a new occurrence version, and a withdrawal removes
 * the record from every later read while preserving authorship and before/after snapshots.
 */
@Service
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class PublishedEditorService {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    /** Keys are the HTTP contract; values are the only columns an approval may write. */
    private static final Map<String,String> COLUMNS=Map.ofEntries(
        Map.entry("title","title"),Map.entry("description","description"),Map.entry("category","category"),
        Map.entry("type","occurrence_type"),Map.entry("subtype","subtype"),Map.entry("situation","situation"),
        Map.entry("reliability","reliability_score"),Map.entry("municipality","municipality"),
        Map.entry("neighborhood","neighborhood"),Map.entry("locationPrecision","location_precision"),
        Map.entry("longitude","longitude"),Map.entry("latitude","latitude"),
        Map.entry("occurredAt","occurred_at"),Map.entry("occurredFrom","occurred_from"),Map.entry("occurredUntil","occurred_until"));
    private static final Set<String> ACTIONS=Set.of("CORRECTION","RETRACTION");
    private static final Set<String> DECISIONS=Set.of("APPROVE","DISCARD");
    private final JdbcTemplate jdbc;private final Clock clock;
    public PublishedEditorService(JdbcTemplate jdbc,Clock clock){this.jdbc=jdbc;this.clock=clock;}

    public Object queue(UUID actor){
        audit(actor,"CORRECTION_EDITS_READ",null);
        var rows=jdbc.queryForList(SELECT+" WHERE r.target_kind='OCCURRENCE' AND r.state IN ('RECEIVED','IN_REVIEW') ORDER BY (p.state='PREPARED') DESC,r.created_at,r.id");
        rows.forEach(PublishedEditorService::project);
        return Map.of("items",rows,"essentialReasons",jdbc.queryForList("SELECT code,label FROM correction_essential_reasons ORDER BY code"));
    }

    public Object occurrence(String id,UUID actor){
        audit(actor,"CORRECTION_TARGET_READ",id);
        var rows=jdbc.queryForList("SELECT id,publication_status,revision FROM occurrences WHERE id=?",id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Ocorrência indisponível.");
        return rows.getFirst();
    }

    public Object find(UUID request,UUID actor){
        audit(actor,"CORRECTION_EDIT_READ",request.toString());
        return details(request);
    }

    @Transactional public Object prepare(UUID request,UUID actor,Map<String,Object> body){
        if(!Set.of("action","changes","reason","evidence","essentialReason","expectedVersion").containsAll(body.keySet()))throw CorrectionService.invalid("Campos da preparação inválidos.");
        String action=PublicationDraft.text(body,"action",20);
        if(!ACTIONS.contains(action))throw CorrectionService.invalid("Preparação deve ser correção ou retirada.");
        var rows=jdbc.queryForList("SELECT * FROM correction_requests WHERE id=? FOR UPDATE",request);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Solicitação indisponível.");
        var requestRow=rows.getFirst();
        if(!requestRow.get("target_kind").equals("OCCURRENCE"))throw CorrectionService.invalid("Edição de publicação exige alvo de ocorrência.");
        if(!Set.of("RECEIVED","IN_REVIEW").contains((String)requestRow.get("state")))throw conflict("Solicitação já encerrada; não é possível preparar alteração.");
        String target=(String)requestRow.get("target_id");
        var occurrence=published(target);
        if(PublicationDraft.integer(body,"expectedVersion")!=(Integer)occurrence.get("revision"))throw conflict("Ocorrência mudou desde a leitura; recarregue antes de preparar.");
        String reason=PublicationDraft.text(body,"reason",2000);
        String evidence=body.get("evidence")==null?"":PublicationDraft.text(body,"evidence",2000);
        if(reason.isBlank()||evidence.isBlank())throw CorrectionService.invalid("Preparação exige motivo e evidência da conferência.");
        var changes=changes(body,action,occurrence);
        String essential=essential(body,action);
        jdbc.update("DELETE FROM occurrence_editor_preparations WHERE request_id=? AND state='PREPARED'",request);
        jdbc.update("INSERT INTO occurrence_editor_preparations(request_id,action,target_id,target_revision,changes,essential_reason,reason,evidence,prepared_at,author_id) VALUES(?,?,?,?,?::jsonb,?,?,?,?,?)",
            request,action,target,occurrence.get("revision"),JSON.writeValueAsString(changes),essential,reason,evidence,Timestamp.from(clock.instant()),actor);
        audit(actor,action.equals("RETRACTION")?"CORRECTION_RETRACTION_PREPARED":"CORRECTION_PREPARATION_PREPARED",target);
        return details(request);
    }

    @Transactional public Object decide(UUID request,UUID actor,Map<String,Object> body){
        if(!Set.of("decision","reason","expectedVersion").containsAll(body.keySet()))throw CorrectionService.invalid("Campos da decisão inválidos.");
        String decision=PublicationDraft.text(body,"decision",20);
        if(!DECISIONS.contains(decision))throw CorrectionService.invalid("Decisão inválida.");
        String reason=PublicationDraft.text(body,"reason",2000);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?::text,0))",request.toString());
        var rows=jdbc.queryForList("SELECT p.*,r.state AS request_state,r.version AS request_version,r.privacy_review_required FROM occurrence_editor_preparations p JOIN correction_requests r ON r.id=p.request_id WHERE p.request_id=? FOR UPDATE OF p,r",request);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Preparação indisponível.");
        var row=rows.getFirst();
        if(PublicationDraft.integer(body,"expectedVersion")!=(Integer)row.get("request_version"))throw conflict("Solicitação mudou; recarregue antes de decidir.");
        if(!row.get("state").equals("PREPARED"))throw conflict("Preparação já decidida; nenhuma alteração nova foi aplicada.");
        if(Boolean.TRUE.equals(row.get("privacy_review_required")))throw CorrectionService.invalid("Revise os dados pessoais da solicitação antes de decidir.");
        String target=(String)row.get("target_id"),action=(String)row.get("action");
        String before=snapshot(target);
        boolean withdrawal=action.equals("RETRACTION");
        if(decision.equals("DISCARD")){
            jdbc.update("UPDATE occurrence_editor_preparations SET state='DISCARDED' WHERE request_id=?",request);
            boolean drafting=row.get("request_state").equals("RECEIVED");
            if(drafting)jdbc.update("UPDATE correction_requests SET state='NOT_APPLICABLE',reason=?,version=version+1 WHERE id=?",reason,request);
            record(request,withdrawal?"CORRECTION_RETRACTION_DISCARDED":"CORRECTION_PREPARATION_DISCARDED",target,before,before,actor);
            audit(actor,"CORRECTION_PREPARATION_DISCARDED",target);
            return Map.of("preparation","DISCARDED","requestDecided",drafting);
        }
        if(!row.get("request_state").equals("IN_REVIEW"))throw CorrectionService.invalid("Aprovação exige solicitação em análise pela Administração.");
        var occurrence=published(target);
        int version=(Integer)occurrence.get("revision");
        if(version!=(Integer)row.get("target_revision"))throw conflict("Ocorrência já tem versão mais nova; preserve as duas decisões e reconcilie antes de aprovar.");
        var competing=jdbc.queryForList("SELECT p.request_id,p.target_revision FROM occurrence_editor_preparations p JOIN correction_requests r ON r.id=p.request_id WHERE p.target_id=? AND p.state='PREPARED' AND p.request_id<>? AND r.state='IN_REVIEW' ORDER BY p.prepared_at",target,request);
        if(!competing.isEmpty())throw conflict("Existe preparação concorrente para esta ocorrência ("+competing.getFirst().get("request_id")+"); preserve as duas decisões e reconcilie antes de aplicar.");
        String after=apply(target,action,proposed(row));
        int applied=version+1;
        jdbc.update("UPDATE occurrence_editor_preparations SET state='APPLIED',applied_revision=?,applied_version=?,applied_at=?,author_id=? WHERE request_id=?",version,applied,Timestamp.from(clock.instant()),actor,request);
        jdbc.update("UPDATE correction_requests SET state='COMPLETED',reason=?,applied_version=?,version=version+1 WHERE id=?",reason,applied,request);
        record(request,withdrawal?"CORRECTION_RETRACTED":"CORRECTION_APPLIED",target,before,after,actor);
        audit(actor,withdrawal?"CORRECTION_RETRACTED":"CORRECTION_APPLIED",target);
        return Map.of("preparation","APPLIED","action",action,"occurrenceVersion",applied,"before",JSON.readTree(before),"after",JSON.readTree(after));
    }

    /** Applies only the proposed keys. The derived record is the stored after state of the decision. */
    private String apply(String id,String action,Map<String,Object> proposed){
        var published=published(id);
        if(action.equals("RETRACTION")){
            jdbc.update("UPDATE occurrences SET publication_status='WITHDRAWN',withdrawn_at=?,revision=revision+1 WHERE id=?",Timestamp.from(clock.instant()),id);
            return snapshot(id);
        }
        Map<String,Object> effective=PublishedCore.validate(proposed,published);
        var assignments=new StringBuilder();var values=new ArrayList<>();
        for(String key:proposed.keySet()){
            if(key.equals("longitude")||key.equals("latitude"))continue;
            assignments.append(assignments.isEmpty()?"":",").append(COLUMNS.get(key)).append("=?");
            values.add(effective.get(key));
        }
        if(proposed.containsKey("longitude")||proposed.containsKey("latitude")){
            Double longitude=coordinateValue(effective.get("longitude")),latitude=coordinateValue(effective.get("latitude"));
            assignments.append(assignments.isEmpty()?"":",").append("location=").append(longitude==null&&latitude==null?"NULL":"ST_SetSRID(ST_MakePoint(?::double precision,?::double precision),4326)::geography");
            if(longitude!=null||latitude!=null){values.add(longitude);values.add(latitude);}
        }
        values.add(id);
        jdbc.update("UPDATE occurrences SET "+assignments+",revision=revision+1 WHERE id=?",values.toArray());
        return snapshot(id);
    }

    private Map<String,Object> changes(Map<String,Object> body,String action,Map<String,Object> current){
        if(action.equals("RETRACTION")){
            if(body.get("changes")!=null&&!(body.get("changes") instanceof Map<?,?> map&&map.isEmpty()))throw CorrectionService.invalid("Retirada não combina correção material; use o pedido correspondente.");
            return Map.of();
        }
        if(!(body.get("changes") instanceof Map<?,?> map)||map.isEmpty())throw CorrectionService.invalid("Correção exige os campos sustentados que serão alterados.");
        @SuppressWarnings("unchecked") Map<String,Object> proposed=(Map<String,Object>)map;
        if(!proposed.keySet().stream().allMatch(COLUMNS::containsKey))throw CorrectionService.invalid("Campo factual não declarado.");
        Map<String,Object> effective=PublishedCore.validate(proposed,current);
        if(PublishedCore.unchanged(proposed,current,effective))throw CorrectionService.invalid("A correção proposta não altera nenhum campo do registro publicado.");
        return proposed;
    }

    private String essential(Map<String,Object> body,String action){
        Object raw=body.get("essentialReason");
        if(action.equals("CORRECTION")){
            if(raw!=null)throw CorrectionService.invalid("Razão essencial pertence apenas à retirada.");
            return null;
        }
        String code=PublicationDraft.text(body,"essentialReason",60);
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM correction_essential_reasons WHERE code=?)",Boolean.class,code)))throw CorrectionService.invalid("Razão essencial não declarada para retirada.");
        return code;
    }

    private static final String SELECT="SELECT r.id,r.target_kind,r.target_id,r.problem_type,r.explanation,r.state,r.version,r.reason,r.applied_version,r.created_at,r.privacy_review_required,p.action AS preparation_action,p.state AS preparation_state,p.reason AS preparation_reason,p.evidence AS preparation_evidence,p.target_revision,p.changes::text AS changes,p.essential_reason,p.author_id,p.historical_actor_id,p.prepared_at,p.applied_revision,p.applied_version AS preparation_applied_version FROM correction_requests r LEFT JOIN occurrence_editor_preparations p ON p.request_id=r.id";

    private Object details(UUID request){
        var rows=jdbc.queryForList(SELECT+" WHERE r.id=?",request);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Solicitação indisponível.");
        var row=rows.getFirst();project(row);return row;
    }

    /** The driver hands JSONB back as PGobject; both forms are read without copying the document. */
    private static String json(Object value){return value==null?null:value instanceof String text?text:value.toString();}

    @SuppressWarnings("unchecked") private static Map<String,Object> proposed(Map<String,Object> row){
        return JSON.convertValue(JSON.readTree(json(row.get("changes"))),Map.class);
    }

    private static void project(Map<String,Object> row){
        if(row.get("changes")!=null)row.put("changes",JSON.readTree(json(row.get("changes"))));
    }

    /**
     * Published row with its coordinates projected, so a point correction is compared against the same
     * geographic fields the catalogue exposes. A territory-only register keeps both coordinates absent.
     */
    private Map<String,Object> published(String id){
        var rows=jdbc.queryForList("SELECT o.*,ST_X(o.location::geometry) AS longitude,ST_Y(o.location::geometry) AS latitude FROM occurrences o WHERE o.id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Ocorrência indisponível.");
        if(!rows.getFirst().get("publication_status").equals("PUBLISHED"))throw conflict("Ocorrência já foi retirada; nenhuma alteração nova é possível.");
        var row=rows.getFirst();
        if(row.get("longitude")==null)row.remove("latitude");
        return row;
    }

    private String snapshot(String id){
        return jdbc.queryForObject("SELECT (to_jsonb(o)-'location') || jsonb_build_object('longitude',ST_X(location::geometry),'latitude',ST_Y(location::geometry)) FROM occurrences o WHERE id=?",String.class,id);
    }

    private void record(UUID request,String action,String target,String before,String after,UUID actor){
        jdbc.update("INSERT INTO correction_editor_audit(request_id,action,target_id,before_snapshot,after_snapshot,author_id,occurred_at) VALUES(?,?,?,?::jsonb,?::jsonb,?,?)",request,action,target,before,after,actor,Timestamp.from(clock.instant()));
    }

    private void audit(UUID actor,String action,String target){
        jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,module,action,outcome,parameters) VALUES(?,?,'audit',?,'SUCCEEDED',jsonb_build_object('recordId',?::text))",actor,Timestamp.from(clock.instant()),action,target);
    }

    private static Double coordinateValue(Object value){
        if(value==null)return null;
        if(value instanceof Number number)return number.doubleValue();
        throw CorrectionService.invalid("Coordenada inválida na preparação.");
    }

    static ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}
}
