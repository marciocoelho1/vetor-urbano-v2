package br.com.vetorurbano.api.territories;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import br.com.vetorurbano.api.corrections.CorrectionService;

/** Synthetic territorial editor. Revision and approval are distinct, locked decisions. */
@Service
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class TerritorialService {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private static final Set<String> VERSION_FIELDS=Set.of("expectedVersion","name","indicatedGroup","sourceId","evidenceReference","referenceDate","limitations","geometry","justification");
    private final JdbcTemplate jdbc;
    private final TerritorialVersionRepository repository;
    private final Clock clock;
    public TerritorialService(JdbcTemplate jdbc,TerritorialVersionRepository repository,Clock clock) {
        this.jdbc=jdbc;this.repository=repository;this.clock=clock;
    }

    public List<Map<String,Object>> list(boolean admin,UUID actor) {
        if(admin) audit(actor,"TERRITORIES_READ",Map.of());
        return snapshots(admin?"v.version=i.revision":"v.version=i.approved_version",new Object[0],admin);
    }
    public List<Map<String,Object>> history(UUID id,UUID actor) {
        audit(actor,"TERRITORY_HISTORY_READ",Map.of("territoryId",id));
        return snapshots("v.territory_id=?",new Object[]{id},true);
    }
    @Transactional
    public Map<String,Object> revise(UUID id,Map<String,Object> body,UUID actor) {
        if(!body.keySet().equals(VERSION_FIELDS))throw CorrectionService.invalid("Campos da revisão territorial inválidos.");
        int expected=version(body);String reason=text(body,"justification",2000,false);
        String name=text(body,"name",200,false),group=text(body,"indicatedGroup",200,true);
        String evidence=text(body,"evidenceReference",4000,true),source=text(body,"sourceId",200,true);
        String limitations=text(body,"limitations",4000,true);
        if("Disputado".equals(group)&&evidence==null)throw CorrectionService.invalid("Disputado exige referência específica à evidência de disputa.");
        LocalDate reference=null;
        if(body.get("referenceDate")!=null) {
            if(!(body.get("referenceDate") instanceof String date)||!date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw CorrectionService.invalid("Referência temporal deve ser dia conhecido ou null.");
            try {reference=LocalDate.parse(date);}catch(DateTimeException invalid){throw CorrectionService.invalid("Data de referência inválida.");}
        }
        if(!(body.get("geometry") instanceof Map<?,?> geometry)||!Set.of("type","coordinates").equals(geometry.keySet())||!Set.of("Polygon","MultiPolygon").contains(geometry.get("type")))throw CorrectionService.invalid("Geometria deve ser GeoJSON Polygon/MultiPolygon 2D WGS 84.");
        // GeoJSON has WGS84 semantics; reject a CRS override, never reproject/repair coordinates.
        String ewkt=jdbc.queryForObject("SELECT ST_AsEWKT(ST_GeomFromGeoJSON(?))",String.class,JSON.writeValueAsString(geometry));
        jdbc.update("INSERT INTO territorial_identities(id) VALUES(?) ON CONFLICT DO NOTHING",id);
        var identity=lock(id);if((Integer)identity.get("revision")!=expected)throw conflict();
        Map<String,Object> before=expected==0?null:one(id,expected);
        repository.append(id,expected,new TerritorialVersion(name,group,source,evidence,reference,limitations,ewkt),actor,reason);
        var after=one(id,expected+1);
        record(id,"TERRITORY_REVISED",before,after,actor,reason);
        return after;
    }
    @Transactional
    public Map<String,Object> approve(UUID id,Map<String,Object> body,UUID actor) {
        if(!body.keySet().equals(Set.of("expectedVersion","justification")))throw CorrectionService.invalid("Campos da aprovação inválidos.");
        int expected=version(body);String reason=text(body,"justification",2000,false);
        var identity=lock(id);Integer previous=(Integer)identity.get("approved_version");
        if(expected==0||(Integer)identity.get("revision")!=expected||Objects.equals(previous,expected))throw conflict();
        Map<String,Object> before=previous==null?null:one(id,previous);
        jdbc.update("INSERT INTO territorial_approvals(territory_id,version,previous_version,author_id,actor_role,justification,occurred_at) VALUES(?,?,?,?,'ADMIN',?,?)",id,expected,previous,actor,reason,Timestamp.from(clock.instant()));
        jdbc.update("UPDATE territorial_identities SET approved_version=? WHERE id=?",expected,id);
        // The private correction channel reads this projection, never an unapproved revision.
        jdbc.update("""
            INSERT INTO correction_area_targets(id,version,name,evidence_reference,validated_by,validated_at)
            SELECT territory_id::text,version,name,evidence_reference,?,? FROM territorial_versions WHERE territory_id=? AND version=?
            ON CONFLICT(id) DO UPDATE SET version=excluded.version,name=excluded.name,
                evidence_reference=excluded.evidence_reference,validated_by=excluded.validated_by,
                historical_actor_id=NULL,validated_at=excluded.validated_at
            """,actor,Timestamp.from(clock.instant()),id,expected);
        var after=one(id,expected);record(id,"TERRITORY_APPROVED",before,after,actor,reason);return after;
    }
    private Map<String,Object> lock(UUID id) {
        var rows=jdbc.queryForList("SELECT revision,approved_version FROM territorial_identities WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Área territorial indisponível.");
        return rows.getFirst();
    }
    private Map<String,Object> one(UUID id,int version) {
        return snapshots("v.territory_id=? AND v.version=?",new Object[]{id,version},true).getFirst();
    }
    private List<Map<String,Object>> snapshots(String where,Object[] arguments,boolean admin) {
        return jdbc.query("""
            SELECT v.*,i.approved_version,sv.name AS source_name,sv.public_url AS source_url,ST_AsGeoJSON(v.boundary,15,0) AS geometry
            FROM territorial_versions v JOIN territorial_identities i ON i.id=v.territory_id
            LEFT JOIN sources s ON s.id=v.source_id
            LEFT JOIN source_versions sv ON sv.source_id=s.id AND sv.version=v.source_version WHERE
            """+where+" ORDER BY v.territory_id,v.version",(row,index)-> {
                var result=new LinkedHashMap<String,Object>();
                result.put("territoryId",row.getObject("territory_id",UUID.class));result.put("version",row.getInt("version"));
                result.put("approvedVersion",row.getObject("approved_version",Integer.class));result.put("name",row.getString("name"));
                result.put("indicatedGroup",row.getString("indicated_group"));result.put("sourceId",row.getString("source_id"));
                result.put("sourceName",row.getString("source_name"));result.put("sourceUrl",row.getString("source_url"));
                result.put("evidenceReference",row.getString("evidence_reference"));result.put("referenceDate",row.getObject("reference_date",LocalDate.class));
                result.put("limitations",row.getString("limitations"));result.put("recordedAt",row.getTimestamp("recorded_at").toInstant());
                result.put("geometry",JSON.readTree(row.getString("geometry")));
                if(admin) {
                    result.put("actor",row.getObject("author_id",UUID.class));result.put("historicalActor",row.getObject("historical_actor_id",UUID.class));
                    result.put("actorRole",row.getString("actor_role"));result.put("justification",row.getString("justification"));
                }
                return result;
            },arguments);
    }
    /** Factual audit snapshots intentionally never duplicate a login UUID in JSON. */
    private static Map<String,Object> factual(Map<String,Object> snapshot) {
        if(snapshot==null)return null;
        var result=new LinkedHashMap<>(snapshot);
        for(String key:List.of("actor","historicalActor","actorRole","justification"))result.remove(key);
        return result;
    }
    private void record(UUID id,String action,Map<String,Object> before,Map<String,Object> after,UUID actor,String reason) {
        jdbc.update("INSERT INTO territorial_audit_events(territory_id,action,before_snapshot,after_snapshot,author_id,actor_role,justification,occurred_at) VALUES(?,?,?::jsonb,?::jsonb,?,'ADMIN',?,?)",id,action,JSON.writeValueAsString(factual(before)),JSON.writeValueAsString(factual(after)),actor,reason,Timestamp.from(clock.instant()));
        var parameters=new LinkedHashMap<String,Object>();parameters.put("territoryId",id);parameters.put("version",after.get("version"));
        parameters.put("approvedVersion",after.get("approvedVersion"));parameters.put("before",logSummary(before));parameters.put("after",logSummary(after));
        audit(actor,action,parameters);
    }
    private static Map<String,Object> logSummary(Map<String,Object> snapshot) {
        if(snapshot==null)return null;
        var result=new LinkedHashMap<String,Object>();
        for(String field:List.of("territoryId","version","approvedVersion","name","indicatedGroup","sourceId","referenceDate","recordedAt"))result.put(field,snapshot.get(field));
        return result;
    }
    private void audit(UUID actor,String action,Map<String,Object> parameters) {
        jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,module,action,outcome,parameters) VALUES(?,?,'territories',?,'SUCCEEDED',?::jsonb)",actor,Timestamp.from(clock.instant()),action,JSON.writeValueAsString(parameters));
    }
    private static int version(Map<String,Object> body) {
        if(!(body.get("expectedVersion") instanceof Integer n)||n<0)throw CorrectionService.invalid("Versão esperada inválida.");
        return n;
    }
    private static String text(Map<String,Object> body,String field,int max,boolean nullable) {
        if(body.get(field)==null&&nullable)return null;
        if(!(body.get(field) instanceof String value)||value.isBlank()||value.length()>max)throw CorrectionService.invalid("Revise "+field+".");
        return value.strip();
    }
    private static ResponseStatusException conflict(){return new ResponseStatusException(HttpStatus.CONFLICT,"Versão territorial mudou ou aprovação já aplicada. Recarregue antes de decidir.");}
}
