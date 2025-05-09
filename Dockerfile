# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies with legacy peer deps to bypass conflicts
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the app
COPY . .

# Build the app
RUN npm run build

# Production stage - Serve using nginx
FROM nginx:alpine

# Copy built app from previous stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
