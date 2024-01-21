FROM node:14

WORKDIR /app

RUN apt-get update && \
    apt-get install -y git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/AI-Planning/cloud-solver.git .

RUN npm install

RUN npm install sqlite3 --save

RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 5000

CMD ["node", "web.js"]
