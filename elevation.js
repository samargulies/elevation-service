const limitedMap = require("limited-map");
const { FileTileSet, S3TileSet } = require("./tileset");

const cacheSize = process.env.TILE_SET_CACHE || 128;
const tileFolder = process.env.TILE_SET_PATH || __dirname;
const maxParallelProcessing = 500;

const tiles = tileFolder.startsWith("s3://")
  ? new S3TileSet({ cacheSize })
  : new FileTileSet(tileFolder, { cacheSize });

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

async function handlePOST(event) {
  const payload = await JSON.parse(event.body);
  if (
    !payload ||
    !Array.isArray(payload) ||
    !payload.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
  ) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error:
          "Invalid Payload. Expected a JSON array with latitude-longitude pairs: [[lat, lng], ...]"
      }),
    };
  }

  const result = await limitedMap(
    payload,
    ll => tiles.getElevation(ll),
    maxParallelProcessing
  );
  return result;
}

async function handleGET(event) {
  const lat = parseFloat(event.queryStringParameters.lat);
  const lng = parseFloat(event.queryStringParameters.lng);
  if (lat == null || !Number.isFinite(lat)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          "Invalid Latitude. Expected a float number as query parameter: ?lat=12.3&lng=45.6"
      }),
    };
  }
  if (lng == null || !Number.isFinite(lng)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error:
          "Invalid Longitude. Expected a float number as query parameter: ?lat=12.3&lng=45.6"
      }),
    };
  }
  const result = await tiles.getElevation([lat, lng]);
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({elevation: result}),
  };
}

async function handler(event) {
  switch (event.httpMethod) {
    case "POST":
      return handlePOST(event);
    case "GET":
        return handleGET(event);
    case "OPTIONS":
      return {
        statusCode: 200,
        headers,
      };
    default:
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Only GET or POST allowed", event }),
      };
  }
}

module.exports = { handler };
