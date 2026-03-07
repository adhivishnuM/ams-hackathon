# Use Puppeteer image to guarantee all Chrome dependencies for WhatsApp web are installed
FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install ffmpeg (needed for edge-tts and speech transcription)
USER root
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Switch back to the non-root user for security
USER pptruser

WORKDIR /app

# Tell Puppeteer to skip downloading Chrome and use the installed one
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Copy package files and install dependencies
COPY --chown=pptruser:pptruser package*.json ./
RUN npm install

# Copy application code
COPY --chown=pptruser:pptruser . .

# Expose the API port
EXPOSE 3001

# Start both the web server and the WhatsApp bridge
CMD ["npm", "start"]
