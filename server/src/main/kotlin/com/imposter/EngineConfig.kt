package com.imposter

import com.imposter.engine.GameEngine
import com.imposter.engine.WordBank
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock
import kotlin.random.Random

@Configuration
class EngineConfig {
    /** One shared clock bean, so tests can swap in a fixed one. */
    @Bean
    fun clock(): Clock = Clock.systemUTC()

    // Random.Default is thread-safe, which matters because many room actors use the one engine at once.
    @Bean
    fun gameEngine(words: WordBank, clock: Clock) = GameEngine(words, clock::millis, Random.Default)
}
