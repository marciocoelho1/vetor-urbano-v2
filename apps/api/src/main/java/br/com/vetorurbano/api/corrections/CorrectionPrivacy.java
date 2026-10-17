package br.com.vetorurbano.api.corrections;

import java.util.*;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;

/** Removes declared identity and direct contact data, retaining factual evidence for restricted review.
 * Contextual identification cannot be solved by a text filter; remaining content requires human review.
 */
public final class CorrectionPrivacy {
    private CorrectionPrivacy() {}
    public static void detach(JdbcTemplate jdbc,UUID account,String name,String email){
        var rows=jdbc.queryForList("SELECT id,explanation,private_references FROM correction_requests WHERE requester_id=? FOR UPDATE",account);
        for(var row:rows)jdbc.update("UPDATE correction_requests SET requester_id=NULL,explanation=?,private_references=?,privacy_review_required=true WHERE id=?",
            minimize((String)row.get("explanation"),account,name,email),minimize((String)row.get("private_references"),account,name,email),row.get("id"));
    }
    static String minimize(String text,UUID account,String name,String email){
        String result=text;
        for(String identity:List.of(account.toString(),name,email))
            if(!identity.isBlank())result=result.replaceAll("(?iu)"+Pattern.quote(identity),"[identidade removida]");
        return result.replaceAll("(?iu)[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}","[contato removido]")
            .replaceAll("(?<![\\w])(?:\\+55[ .-]?)?(?:\\(?\\d{2}\\)?[ .-]?)?\\d{4,5}[ .-]\\d{4}(?![\\w])","[contato removido]");
    }
}
