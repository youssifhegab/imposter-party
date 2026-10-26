package com.imposter.api

import com.imposter.protocol.ErrorPayload
import com.imposter.protocol.ProtocolError
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

class ApiException(val status: HttpStatus, val code: String) : RuntimeException(code)

/** Turns exceptions thrown by any controller into `{code, message}` JSON with the right status. */
@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ApiException::class)
    fun api(e: ApiException): ResponseEntity<ErrorPayload> = ResponseEntity.status(e.status).body(ErrorPayload.of(e.code))

    // Missing fields, wrong types, or broken JSON in a request body.
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadable(): ResponseEntity<ErrorPayload> =
        ResponseEntity.badRequest().body(ErrorPayload.of(ProtocolError.INVALID_INPUT))
}
