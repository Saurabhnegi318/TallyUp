# Stage 1: Build JAR
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml ../pom.xml
COPY api-gateway/pom.xml ../api-gateway/pom.xml
COPY group-service/pom.xml ../group-service/pom.xml
COPY expense-service/pom.xml ../expense-service/pom.xml
COPY settlement-service/pom.xml pom.xml
COPY settlement-service/src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal runtime image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
ENV JAVA_TOOL_OPTIONS="-XX:+UseSerialGC -Xmx256m -Xss512k"
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java", "-jar", "app.jar"]
