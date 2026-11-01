# Use LTS Node.js Debian Bookworm slim base image
FROM node:22-bookworm-slim

WORKDIR /app

# Copy dependency manifests
COPY package.json ./

# Install dependencies inside the container
RUN npm install

# Copy source code, docs, and configuration
COPY tsconfig.json ./
COPY src ./src
COPY docs ./docs

# Expose port 3000
EXPOSE 3000

# Run development server with live reload via tsx
CMD ["npm", "run", "dev"]
