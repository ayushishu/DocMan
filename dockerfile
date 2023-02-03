#version 1.0

FROM node:alpine

WORKDIR /my-app
COPY . .


RUN npm install
RUN npm install express
RUN npm install axios
RUN npm install express-fileupload
RUN npm install ejs
RUN npm install multer
RUN npm install fs

# EXPOSE 3004
CMD [ "npm", "start" ]