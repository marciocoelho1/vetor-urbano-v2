package br.com.vetorurbano.api.auth;

import java.io.IOException;
import java.util.Set;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

@Component
public class AccessBoundary extends OncePerRequestFilter {
    private final ObjectProvider<AuthService> service;
    private final JsonMapper json=JsonMapper.builder().build();
    public AccessBoundary(ObjectProvider<AuthService> service) {this.service=service;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        String path=request.getServletPath().replaceAll("/{2,}","/");
        if(!path.startsWith("/api/v1/")) {chain.doFilter(request,response);return;}
        response.setHeader("Cache-Control","no-store");
        response.setHeader("X-Content-Type-Options","nosniff");
        String origin=request.getHeader("Origin");
        if(!request.getMethod().equals("OPTIONS")&&origin!=null&&Set.of("http://127.0.0.1:4201","http://localhost:4201").contains(origin)) {
            response.setHeader("Access-Control-Allow-Origin",origin);
            response.setHeader("Access-Control-Allow-Credentials","true");
            response.addHeader("Vary","Origin");
        }
        if(!request.getMethod().equals("OPTIONS")&&origin!=null&&!Set.of("http://127.0.0.1:4201","http://localhost:4201").contains(origin)) {
            fail(response,403,"ORIGIN_DENIED","Origem não autorizada.");return;
        }
        if(request.getMethod().equals("OPTIONS")||path.startsWith("/api/v1/accounts/")||path.startsWith("/api/v1/auth/")) {chain.doFilter(request,response);return;}
        if(request.getMethod().equals("GET")&&path.equals("/api/v1/sources")) {chain.doFilter(request,response);return;}
        var auth=service.getIfAvailable();
        if(auth==null) {fail(response,503,"ACCESS_UNAVAILABLE","Serviço de acesso indisponível.");return;}
        AuthService.Reply decision;
        boolean administrator = path.equals("/api/v1/admin/sources") || path.startsWith("/api/v1/admin/sources/");
        try {decision=auth.authorize(AuthController.token(request),administrator);}
        catch(RuntimeException e) {fail(response,503,"ACCESS_UNAVAILABLE","Serviço de acesso indisponível. Tente novamente.");return;}
        if(decision.status()!=200) {response.setStatus(decision.status());response.setContentType("application/json");json.writeValue(response.getOutputStream(),decision.body());return;}
        request.setAttribute("vu.account",decision.body().get("accountId"));
        chain.doFilter(request,response);
    }
    private void fail(HttpServletResponse response,int status,String code,String message)throws IOException {
        response.setStatus(status);response.setContentType("application/json");json.writeValue(response.getOutputStream(),java.util.Map.of("code",code,"message",message));
    }
}
