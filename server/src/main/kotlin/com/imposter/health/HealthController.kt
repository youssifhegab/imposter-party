package com.imposter.health

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

// @RestController = a controller whose return values are serialized to JSON (via Jackson) instead of rendering views.
@RestController
class HealthController {
    @GetMapping("/api/health")
    fun health(): Map<String, String> = mapOf("status" to "ok")
}
