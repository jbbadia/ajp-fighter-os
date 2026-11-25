package com.ajp.fighteros.config;

import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built frontend (frontend/dist) from the same origin as the API, so the whole app
 * is reachable at one address (e.g. from a phone). Unknown non-API paths fall back to
 * index.html so client-side routes like /calendario work on reload.
 */
@Configuration
public class FrontendConfig implements WebMvcConfigurer {

    private final String location;

    public FrontendConfig(@Value("${app.frontend-dist:file:../frontend/dist/}") String location) {
        this.location = location.endsWith("/") ? location : location + "/";
    }

    /** The resource handler never sees the empty root path, so forward it explicitly. */
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations(location)
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String path, Resource base) throws IOException {
                        Resource file = base.createRelative(path);
                        if (file.exists() && file.isReadable()) return file;
                        // API and actuator paths must 404 normally, never return the app shell.
                        if (path.startsWith("api/") || path.startsWith("actuator")) return null;
                        Resource index = base.createRelative("index.html");
                        return index.exists() ? index : null;
                    }
                });
    }
}
