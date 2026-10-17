package br.com.vetorurbano.api.moderation;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Current factual projection plus append-only domain history; called within moderation transactions. */
@Component
@org.springframework.context.annotation.Profile("local")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class PublicationStore {
    private final JdbcTemplate jdbc;private final Clock clock;
    public PublicationStore(JdbcTemplate jdbc,Clock clock){this.jdbc=jdbc;this.clock=clock;}
    public String snapshot(String id){return jdbc.queryForObject("SELECT (to_jsonb(o)-'location') || jsonb_build_object('longitude',ST_X(location::geometry),'latitude',ST_Y(location::geometry),'clippingIds',(SELECT coalesce(jsonb_agg(clipping_id ORDER BY clipping_id),'[]'::jsonb) FROM occurrence_clippings WHERE occurrence_id=o.id)) FROM occurrences o WHERE id=?",String.class,id);}
    public void create(String id,String happening,PublicationDraft d){
        jdbc.update("INSERT INTO occurrences(id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,occurred_from,occurred_until,publication_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ?::double precision IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(?::double precision,?::double precision),4326)::geography END,?,?,?,'PUBLISHED')",
            id,happening,d.title(),d.description(),d.category(),d.type(),d.subtype(),d.situation(),d.reliability(),d.municipality(),d.neighborhood(),d.precision(),d.longitude(),d.longitude(),d.latitude(),ts(d.at()),ts(d.from()),ts(d.until()));
    }
    public void replace(String id,PublicationDraft d){
        jdbc.update("UPDATE occurrences SET title=?,description=?,category=?,occurrence_type=?,subtype=?,situation=?,reliability_score=?,municipality=?,neighborhood=?,location_precision=?,location=CASE WHEN ?::double precision IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(?::double precision,?::double precision),4326)::geography END,occurred_at=?,occurred_from=?,occurred_until=?,revision=revision+1 WHERE id=?",
            d.title(),d.description(),d.category(),d.type(),d.subtype(),d.situation(),d.reliability(),d.municipality(),d.neighborhood(),d.precision(),d.longitude(),d.longitude(),d.latitude(),ts(d.at()),ts(d.from()),ts(d.until()),id);
    }
    public void record(String id,String before,String action,String reason,UUID actor){
        jdbc.update("INSERT INTO publication_versions(occurrence_id,version,action,reason,before_snapshot,after_snapshot,author_id,occurred_at) SELECT id,revision,?,?,?::jsonb,?::jsonb,?,? FROM occurrences WHERE id=?",action,reason,before,snapshot(id),actor,Timestamp.from(clock.instant()),id);
        audit(actor,action,id);
    }
    public void audit(UUID actor,String action,String id){jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,module,action,outcome,parameters) VALUES(?,?,'audit',?,'SUCCEEDED',jsonb_build_object('recordId',?::text))",actor,Timestamp.from(clock.instant()),action,id);}
    private static Timestamp ts(java.time.Instant time){return time==null?null:Timestamp.from(time);}
}
