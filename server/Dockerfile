# Two stages: build the jar with the full JDK, then run it on a small JRE-only image.

FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
# Gradle files first, so dependency downloads are cached until the build files change.
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src src
# Tests run on your machine and need a local Postgres; the image only needs the jar.
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/build/libs/app.jar app.jar
# Free hosts give ~512 MB: size the heap from the container limit, and use the low-overhead collector.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -XX:TieredStopAtLevel=1"
# Render (and most hosts) pass the port in $PORT; application.yml reads it.
EXPOSE 8090
CMD ["java", "-jar", "app.jar"]
