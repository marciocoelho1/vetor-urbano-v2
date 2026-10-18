package br.com.vetorurbano.api.corrections;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class CorrectionService {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    public CorrectionService(JdbcTemplate jdbc,Clock clock){this.jdbc=jdbc;this.clock=clock;}
    public static ResponseStatusException invalid(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    static String text(Map<String,Object> body,String field,int max){
        if(!(body.get(field) instanceof String value)||value.isBlank()||value.length()>max)throw invalid("Revise "+field+".");
        return value.strip();
    }
    @Transactional public Map<String,Object> create(Map<String,Object> body,UUID actor){
        if(!body.keySet().equals(Set.of("targetKind","targetId","problemType","explanation","references")))throw invalid("Campos inválidos.");
        String kind=text(body,"targetKind",20),target=text(body,"targetId",200),problem=text(body,"problemType",80),explanation=text(body,"explanation",4000),references=text(body,"references",4000);
        if(!Set.of("LOCAL","DATA","CONTEUDO","REFERENCIA","OUTRO").contains(problem))throw invalid("Tipo de problema inválido.");
        boolean valid=switch(kind){
            case "OCCURRENCE" -> Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM occurrences WHERE id=? AND publication_status='PUBLISHED')",Boolean.class,target));
            case "AREA" -> Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM correction_area_targets WHERE id=?)",Boolean.class,target));
            default -> false;
        };
        if(!valid)throw invalid("Alvo inexistente ou não validado. Áreas experimentais não recebem pedidos.");
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO correction_requests(id,requester_id,target_kind,target_id,problem_type,explanation,private_references,state,created_at) VALUES(?,?,?,?,?,?,?,'RECEIVED',?)",id,actor,kind,target,problem,explanation,references,Timestamp.from(clock.instant()));
        audit(actor,false,"CORRECTION_SUBMITTED",id);
        return details(id,actor,false);
    }
    public List<Map<String,Object>> list(UUID actor,boolean admin){
        audit(actor,admin,"CORRECTION_READ",null);
        var rows=jdbc.queryForList("SELECT * FROM correction_requests WHERE (? OR requester_id=?) ORDER BY CASE state WHEN 'RECEIVED' THEN 0 WHEN 'IN_REVIEW' THEN 1 ELSE 2 END,created_at,id",admin,actor);
        rows.forEach(row->row.remove("requester_id"));return rows;
    }
    public Map<String,Object> find(UUID id,UUID actor,boolean admin){
        var result=details(id,actor,admin);audit(actor,admin,"CORRECTION_READ",id);return result;
    }
    private Map<String,Object> details(UUID id,UUID actor,boolean admin){
        var rows=jdbc.queryForList("SELECT * FROM correction_requests WHERE id=? AND (? OR requester_id=?)",id,admin,actor);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Solicitação indisponível.");
        var result=new LinkedHashMap<>(rows.getFirst());
        result.remove("requester_id");
        result.put("history",jdbc.queryForList("SELECT version,previous_state,state,reason,applied_version,occurred_at FROM correction_decisions WHERE request_id=? ORDER BY version",id));
        return result;
    }
    @Transactional public Map<String,Object> minimize(UUID id,Map<String,Object> body,UUID actor){
        if(!body.keySet().equals(Set.of("expectedVersion","factualSummary","factualReferences")))throw invalid("Campos inválidos.");
        String summary=text(body,"factualSummary",4000),references=text(body,"factualReferences",4000);
        var row=jdbc.queryForList("SELECT * FROM correction_requests WHERE id=? FOR UPDATE",id);
        if(row.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Solicitação indisponível.");
        int version=(Integer)row.getFirst().get("version");
        if(!(body.get("expectedVersion") instanceof Number expected)||expected.intValue()!=version)throw new ResponseStatusException(HttpStatus.CONFLICT,"Solicitação mudou.");
        jdbc.update("UPDATE correction_requests SET explanation=?,private_references=?,privacy_review_required=false,version=version+1 WHERE id=?",summary,references,id);
        String state=(String)row.getFirst().get("state");
        jdbc.update("INSERT INTO correction_decisions(request_id,version,previous_state,state,reason,author_id,occurred_at) VALUES(?,?,?,?,?,?,?)",id,version+1,state,state,"Conteúdo factual revisado e dados pessoais desnecessários removidos.",actor,Timestamp.from(clock.instant()));
        audit(actor,true,"CORRECTION_MINIMIZED",id);return details(id,actor,true);
    }
    @Transactional public Map<String,Object> decide(UUID id,Map<String,Object> body,UUID actor){
        if(!Set.of(Set.of("expectedVersion","state","reason"),Set.of("expectedVersion","state","reason","appliedVersion")).contains(body.keySet()))throw invalid("Campos inválidos.");
        String next=text(body,"state",30),reason=text(body,"reason",2000);
        var rows=jdbc.queryForList("SELECT * FROM correction_requests WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Solicitação indisponível.");
        var row=rows.getFirst();String previous=(String)row.get("state");int version=(Integer)row.get("version");
        if(!(body.get("expectedVersion") instanceof Number expected)||expected.intValue()!=version)throw new ResponseStatusException(HttpStatus.CONFLICT,"Solicitação mudou. Recarregue antes de decidir.");
        if(!(previous.equals("RECEIVED")&&next.equals("IN_REVIEW")||previous.equals("IN_REVIEW")&&Set.of("COMPLETED","NOT_APPLICABLE").contains(next)))throw invalid("Transição inválida.");
        if(Boolean.TRUE.equals(row.get("privacy_review_required")))throw invalid("Revise os dados pessoais do conteúdo factual antes de decidir.");
        Integer applied=null;
        if(body.containsKey("appliedVersion")){
            if(!next.equals("COMPLETED")||!(body.get("appliedVersion") instanceof Number n)||n.intValue()<1)throw invalid("Versão aplicada inválida.");
            applied=((Number)body.get("appliedVersion")).intValue();
            // Ticket 18: an applied occurrence version must be proven by the published/withdrawn register.
            boolean proven=switch((String)row.get("target_kind")){
                case "AREA" -> Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM correction_area_targets WHERE id=? AND version=?)",Boolean.class,row.get("target_id"),applied));
                case "OCCURRENCE" -> Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM occurrences WHERE id=? AND revision=?)",Boolean.class,row.get("target_id"),applied));
                default -> false;
            };
            if(!proven)throw invalid("Versão aplicada não comprovada.");
        }
        jdbc.update("UPDATE correction_requests SET state=?,reason=?,applied_version=?,version=version+1 WHERE id=?",next,reason,applied,id);
        jdbc.update("INSERT INTO correction_decisions(request_id,version,previous_state,state,reason,applied_version,author_id,occurred_at) VALUES(?,?,?,?,?,?,?,?)",id,version+1,previous,next,reason,applied,actor,Timestamp.from(clock.instant()));
        audit(actor,true,"CORRECTION_DECIDED",id);
        return details(id,actor,true);
    }
    private void audit(UUID actor,boolean admin,String action,UUID id){
        jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,module,action,outcome,parameters) VALUES(?,?,?,?, 'SUCCEEDED',jsonb_build_object('requestId',?::text))",actor,Timestamp.from(clock.instant()),admin?"audit":"query",action,id==null?null:id.toString());
    }
}
