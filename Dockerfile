# Production Docker image. One container: the .NET backend serves the API under /api
# and the built frontend for everything else, so both live on the same origin.
# All config comes from env vars set on the deployment; there is no .env file in the image.

# --- Frontend: build the Vite app to static files ---
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Backend: compile and publish the .NET app ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY backend/torque-backend.csproj ./
RUN dotnet restore
COPY backend/ ./
RUN dotnet publish -c Release -o /out --no-restore

# --- Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0
# Npgsql probes for Kerberos on connect and logs an error without it
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend /out ./
# The backend serves wwwroot as the site (see Program.cs)
COPY --from=frontend /frontend/dist ./wwwroot
# PORT: what the server listens on. FORWARDEDHEADERS: trust the X-Forwarded-* headers from
# the ingress in front of us, so the real client IP/https scheme are seen (rate limits etc).
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true \
    ASPNETCORE_HTTP_PORTS= \
    PORT=8080
ENV DOTNET_gcServer=0 \
    DOTNET_GCHeapHardLimitPercent=0x4B


EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "torque-backend.dll"]
