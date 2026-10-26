package com.imposter.api

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

/**
 * Lets a browser call the REST API from another origin, which the web preview of the app needs
 * (it runs on Metro's port). Phones don't send CORS checks at all. Nothing here relies on cookies,
 * and every game action is authorized by the player token, so any origin is fine.
 */
@Configuration
class CorsConfig : WebMvcConfigurer {
    // A WebMvcConfigurer bean is Spring's hook for adjusting MVC setup; Spring calls this at startup.
    override fun addCorsMappings(registry: CorsRegistry) {
        registry.addMapping("/api/**").allowedOrigins("*").allowedMethods("GET", "POST")
    }
}
