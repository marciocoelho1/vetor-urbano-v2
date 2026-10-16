package br.com.vetorurbano.api.auth;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class AuthController {
    private final AuthService service;private final AuthSettings settings;
    public AuthController(AuthService service,AuthSettings settings) { this.service=service;this.settings=settings; }
    public static String token(HttpServletRequest request) {
        if(request.getCookies()!=null) for(var cookie:request.getCookies()) if(cookie.getName().equals("vu_session"))return cookie.getValue();
        return null;
    }
    private ResponseEntity<Map<String,Object>> respond(AuthService.Reply reply) {
        var builder=ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore());
        if(reply.status()==429)builder.header("Retry-After","300");
        if(reply.cookie()!=null) builder.header(HttpHeaders.SET_COOKIE,ResponseCookie.from("vu_session",reply.cookie()).httpOnly(true).secure(settings.secureCookie()).sameSite("Strict").path("/api/v1").maxAge(reply.cookie().isEmpty()?0:settings.lifetime().getSeconds()).build().toString());
        return builder.body(reply.body());
    }
    @PostMapping(value="/login",consumes=MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Map<String,Object>> login(@RequestBody Map<String,Object> body,HttpServletRequest request) { return respond(service.login(body,token(request))); }
    @GetMapping("/session") ResponseEntity<Map<String,Object>> status(HttpServletRequest request) {return respond(service.status(token(request)));}
    @GetMapping("/access/{module}") ResponseEntity<Map<String,Object>> access(@PathVariable String module,HttpServletRequest request) {
        if(!Set.of("query","sources","report","history","insights","active").contains(module))return ResponseEntity.notFound().build();
        return respond(service.authorize(token(request),Set.of("sources","report").contains(module)));
    }
    @PostMapping(value="/logout",consumes=MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Map<String,Object>> logout(HttpServletRequest request,@RequestHeader(value="X-CSRF-Token",required=false)String csrf) {return respond(service.logout(token(request),csrf));}
    @PostMapping(value="/mfa/enrollment",consumes=MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Map<String,Object>> enroll(HttpServletRequest request,@RequestHeader(value="X-CSRF-Token",required=false)String csrf) {return respond(service.enroll(token(request),csrf));}
    @PostMapping(value="/mfa/verification",consumes=MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Map<String,Object>> verify(HttpServletRequest request,@RequestHeader(value="X-CSRF-Token",required=false)String csrf,@RequestBody Map<String,Object> body) {return respond(service.verify(token(request),csrf,body));}
}
