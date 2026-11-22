import crypto from "node:crypto";

const getCloudinaryConfig = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error("Cloudinary image upload is not configured");
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    throw error;
  }
  return { cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, apiSecret: CLOUDINARY_API_SECRET };
};

const createSignature = (parameters, apiSecret) => {
  const signedParameters = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${signedParameters}${apiSecret}`).digest("hex");
};

const cloudinaryEndpoint = (cloudName, action) =>
  `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/${action}`;

export async function uploadProfileImage(buffer, mimeType) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = {
    folder: "crewhrcore/profile-pictures",
    public_id: crypto.randomUUID(),
    timestamp,
    transformation: "c_fill,g_face,h_512,w_512",
  };
  const form = new FormData();
  Object.entries(parameters).forEach(([key, value]) => form.append(key, String(value)));
  form.append("api_key", apiKey);
  form.append("signature", createSignature(parameters, apiSecret));
  form.append("file", new Blob([buffer], { type: mimeType }), `profile.${mimeType.split("/")[1]}`);

  const response = await fetch(cloudinaryEndpoint(cloudName, "upload"), {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(`Cloudinary profile image upload failed (${response.status})`);
  }

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteProfileImage(publicId) {
  if (!publicId) return;
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const parameters = {
    public_id: publicId,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, String(value)])),
    api_key: apiKey,
    signature: createSignature(parameters, apiSecret),
  });
  const response = await fetch(cloudinaryEndpoint(cloudName, "destroy"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = await response.json();
  if (!response.ok || !["ok", "not_found"].includes(result.result)) {
    throw new Error(`Cloudinary profile image cleanup failed (${response.status})`);
  }
}
