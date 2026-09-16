# --- Instructions ---
# 1. Build the Docker image:
#      docker build -t omnitrace .
# 2. Run the Docker image:
#      docker run -d -p 8080:80 --name omnitrace omnitrace
# 3. Access the app in your browser at http://localhost:8080
# --------------------

# Stage 1: Build the React application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and install dependencies separately to cache the layer
COPY package*.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the Vite application for production
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:alpine

# Remove default Nginx config and set up single-page app (SPA) routing
RUN rm /etc/nginx/conf.d/default.conf && echo "\
server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
}\n" > /etc/nginx/conf.d/default.conf

# Copy production build files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 inside the container
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
