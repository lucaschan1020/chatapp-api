import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + `/../../.env.${process.env.NODE_ENV}` });

const PORT = process.env.PORT ?? 5000;
const GAPI_CLIENTID = process.env.GAPI_CLIENTID;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

export { PORT, GAPI_CLIENTID, MONGODB_URI, MONGODB_NAME };
