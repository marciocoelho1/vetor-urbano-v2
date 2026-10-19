package br.com.vetorurbano.api.occurrences;

import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import br.com.vetorurbano.api.moderation.PublicationStore;

/** Human evidence belongs to a specific factual version, never to a related happening. */
@Service
public class OccurrenceVerificationService {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final org.springframework.beans.factory.ObjectProvider<PublicationStore> publications;
    public OccurrenceVerificationService(JdbcTemplate jdbc, Clock clock, org.springframework.beans.factory.ObjectProvider<PublicationStore> publications) {
        this.jdbc=jdbc;this.clock=clock;this.publications=publications;
    }
    /** Approved decision: these types get no automatic validity window after a human confirmation. */
    public static final java.util.Set<String> NO_APPROVED_EXTENSION = java.util.Set.of("ROUBO","FURTO","CONFRONTO");
    public static Duration duration(String type) {
        return switch(type) {
            case "CONGESTIONAMENTO", "DISPAROS" -> Duration.ofMinutes(30);
            case "ACIDENTE", "OPERACAO_POLICIAL", "INTERDICAO", "SEMAFOROS", "ALAGAMENTO", "INCENDIO" -> Duration.ofHours(2);
            case "DESLIZAMENTO", "ARVORE", "ENERGIA", "AGUA" -> Duration.ofHours(6);
            case "OBRAS" -> Duration.ofHours(24);
            default -> null;
        };
    }
    private Map<String,Object> effect(String id, UUID actor, boolean lock) {
        var rows=jdbc.queryForList("SELECT id,title,revision,situation,occurrence_type FROM occurrences WHERE id=? AND publication_status='PUBLISHED'"+(lock?" FOR UPDATE":""),id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        String role=jdbc.queryForObject("SELECT role FROM local_accounts WHERE id=?",String.class,actor);
        boolean author=Boolean.TRUE.equals(jdbc.queryForObject("SELECT ?=(SELECT author_id FROM publication_versions WHERE occurrence_id=? AND (author_id IS NOT NULL OR historical_actor_id IS NOT NULL) ORDER BY version LIMIT 1)",Boolean.class,actor,id));
        if(!"ADMIN".equals(role)&&!author) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        var row=rows.getFirst();row.put("role",role);return row;
    }
    public Map<String,Object> read(String id,UUID actor) {
        var row=effect(id,actor,false);
        row.put("verificationVersion",version(id));
        var ttl=duration((String)row.get("occurrence_type"));row.put("validityDurationSeconds",ttl==null?null:ttl.toSeconds());
        row.put("history",jdbc.queryForList("SELECT verification_version,effect_version,previous_situation,situation,evidence,confirmed_at,recorded_at,expires_at,author_id,historical_actor_id,actor_role FROM occurrence_verifications WHERE occurrence_id=? ORDER BY verification_version",id));
        return row;
    }
    private int version(String id) {return jdbc.queryForObject("SELECT coalesce(max(verification_version),0) FROM occurrence_verifications WHERE occurrence_id=?",Integer.class,id);}
    @Transactional public Object confirm(String id,UUID actor,Map<String,Object> body) {
        var row=effect(id,actor,true);
        if(!body.keySet().equals(Set.of("effectVersion","verificationVersion","situation","confirmedAt","evidence"))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        int expected,previous;Instant at;OccurrenceSituation situation;String evidence;
        try {
            expected=Integer.parseInt(body.get("effectVersion").toString());previous=Integer.parseInt(body.get("verificationVersion").toString());
            at=Instant.parse((String)body.get("confirmedAt"));situation=OccurrenceSituation.valueOf((String)body.get("situation"));
            evidence=(String)body.get("evidence");
            if(evidence==null||evidence.isBlank()||evidence.length()>4000||at.isAfter(clock.instant())) throw new IllegalArgumentException();
        } catch(RuntimeException invalid) {throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Revise evidência humana, instante e situação.");}
        if(expected!=((Number)row.get("revision")).intValue()||previous!=version(id)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Ocorrência alterada. Recarregue antes de confirmar.");
        var previousEvidence=jdbc.queryForList("SELECT evidence FROM occurrence_verifications WHERE occurrence_id=? ORDER BY verification_version DESC LIMIT 1",String.class,id);
        if(!previousEvidence.isEmpty()&&previousEvidence.getFirst().trim().equals(evidence.trim()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Registre nova evidência da revisão humana.");
        String before=publications.getObject().snapshot(id);
        int resulting=expected;
        if(!situation.name().equals(row.get("situation"))) {
            jdbc.update("UPDATE occurrences SET situation=?,revision=revision+1 WHERE id=?",situation.name(),id);resulting++;
            publications.getObject().record(id,before,"SITUATION_VERIFIED","Decisão humana de situação",actor);
        }
        var ttl=duration((String)row.get("occurrence_type"));
        jdbc.update("INSERT INTO occurrence_verifications(occurrence_id,verification_version,effect_version,previous_situation,situation,evidence,confirmed_at,recorded_at,expires_at,author_id,actor_role) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            id,previous+1,resulting,row.get("situation"),situation.name(),evidence,Timestamp.from(at),Timestamp.from(clock.instant()),situation==OccurrenceSituation.ONGOING&&ttl!=null?Timestamp.from(at.plus(ttl)):null,actor,row.get("role"));
        return read(id,actor);
    }
    public record VerificationSummary(int effectVersion,int verificationVersion,Instant confirmedAt,Instant expiresAt,boolean appliesToCurrentVersion) {}
    public VerificationSummary summary(String id) {
        var rows=jdbc.query("""
            SELECT v.*,o.revision FROM occurrences o JOIN LATERAL
            (SELECT * FROM occurrence_verifications WHERE occurrence_id=o.id ORDER BY verification_version DESC LIMIT 1) v ON true WHERE o.id=?
            """,(row,n)->new VerificationSummary(row.getInt("effect_version"),row.getInt("verification_version"),row.getTimestamp("confirmed_at").toInstant(),row.getTimestamp("expires_at")==null?null:row.getTimestamp("expires_at").toInstant(),row.getInt("effect_version")==row.getInt("revision")),id);
        return rows.isEmpty()?null:rows.getFirst();
    }
    public List<Map<String,Object>> expired(UUID actor) {
        var role=jdbc.queryForObject("SELECT role FROM local_accounts WHERE id=?",String.class,actor);
        return jdbc.queryForList("""
            SELECT o.id,o.title,o.revision,v.verification_version,v.expires_at FROM occurrences o
            JOIN LATERAL (SELECT * FROM occurrence_verifications WHERE occurrence_id=o.id ORDER BY verification_version DESC LIMIT 1) v ON true
            WHERE o.publication_status='PUBLISHED' AND o.situation='ONGOING' AND v.effect_version=o.revision AND v.expires_at<=?
              AND (?='ADMIN' OR ?=(SELECT p.author_id FROM publication_versions p WHERE p.occurrence_id=o.id AND (p.author_id IS NOT NULL OR p.historical_actor_id IS NOT NULL) ORDER BY p.version LIMIT 1))
            ORDER BY v.expires_at,o.id
            """,Timestamp.from(clock.instant()),role,actor);
    }
}
