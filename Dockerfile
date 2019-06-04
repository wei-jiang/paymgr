FROM novice/build:java as my_build
WORKDIR /data/workspace
# if source is dir, must add target dir name 
COPY src ./src
COPY build.gradle .
RUN gradle build


FROM novice/build:java
COPY --from=my_build /data/workspace/build/libs/paymgr-1.0.jar /app.jar
WORKDIR /data/workspace

EXPOSE 7902
CMD [ "java", "-jar", "/app.jar" ]
# docker build -t paymgr .
# docker build --no-cache -t paymgr . 