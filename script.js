// Global variables
let privateKey, publicKey;
let signature, imageBuffer, imageFileName;

// DOM elements
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const outputDiv = document.getElementById("output");
const imagePreview = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeImageBtn = document.getElementById("removeImage");

// Buttons
const generateKeysBtn = document.getElementById("generateKeysBtn");
const signImageBtn = document.getElementById("signImageBtn");
const verifyBtn = document.getElementById("verifyBtn");
const downloadSigBtn = document.getElementById("downloadSigBtn");
const embedSigBtn = document.getElementById("embedSigBtn");
const clearConsoleBtn = document.getElementById("clearConsole");

// Status elements
const keyStatus = document.getElementById("keyStatus");
const signStatus = document.getElementById("signStatus");
const verifyStatus = document.getElementById("verifyStatus");

// Import elements
const publicKeyImport = document.getElementById("publicKeyImport");
const signatureImport = document.getElementById("signatureImport");

// Utility functions
const log = (msg, type = 'info') => {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  outputDiv.textContent += `[${timestamp}] ${prefix} ${msg}\n`;
  outputDiv.scrollTop = outputDiv.scrollHeight;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const updateButtonStates = () => {
  // Update button states based on current state
  signImageBtn.disabled = !imageBuffer || !privateKey;
  verifyBtn.disabled = !signature || !publicKey || !imageBuffer;
  downloadSigBtn.disabled = !signature;
  embedSigBtn.disabled = !signature || !imageFileName?.endsWith('.png');
};

const updateStatus = (element, message, type = 'info') => {
  element.textContent = message;
  element.className = element.className.replace(/status-\w+/g, '');
  
  if (type === 'success') {
    element.classList.add('status-success');
  } else if (type === 'error') {
    element.classList.add('status-error');
  } else if (type === 'warning') {
    element.classList.add('status-warning');
  }
  
  element.classList.add('status-pulse');
  setTimeout(() => element.classList.remove('status-pulse'), 2000);
};

const addLoadingState = (button) => {
  button.classList.add('loading');
  button.disabled = true;
};

const removeLoadingState = (button) => {
  button.classList.remove('loading');
  button.disabled = false;
};

// File upload handlers
dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("drag-over");
});

dropzone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    await handleImageFile(file);
  } else {
    log("Please drop a valid image file", 'error');
  }
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (file) await handleImageFile(file);
});

removeImageBtn.addEventListener("click", () => {
  imageBuffer = null;
  imageFileName = null;
  signature = null;
  imagePreview.style.display = 'none';
  fileInput.value = '';
  
  updateStatus(signStatus, "Ready to sign");
  updateStatus(verifyStatus, "Not verified");
  updateButtonStates();
  
  log("Image removed", 'info');
});

async function handleImageFile(file) {
  try {
    addLoadingState(generateKeysBtn);
    
    imageBuffer = await file.arrayBuffer();
    imageFileName = file.name;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      fileName.textContent = file.name;
      fileSize.textContent = formatFileSize(file.size);
      imagePreview.style.display = 'block';
      imagePreview.classList.add('fade-in');
    };
    reader.readAsDataURL(file);
    
    // Reset signature state
    signature = null;
    updateStatus(signStatus, "Ready to sign");
    updateStatus(verifyStatus, "Not verified");
    updateButtonStates();
    
    log(`Image loaded: ${file.name} (${formatFileSize(file.size)})`, 'success');
    
  } catch (error) {
    log(`Error loading image: ${error.message}`, 'error');
  } finally {
    removeLoadingState(generateKeysBtn);
  }
}

// Key generation
generateKeysBtn.addEventListener("click", generateKeys);

async function generateKeys() {
  try {
    addLoadingState(generateKeysBtn);
    updateStatus(keyStatus, "Generating keys...");
    
    const keys = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["sign", "verify"]
    );
    
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
    
    updateStatus(keyStatus, "Keys generated successfully", 'success');
    updateButtonStates();
    
    log("RSA key pair generated (2048-bit)", 'success');
    
    // Auto-export public key
    await exportPublicKey();
    
  } catch (error) {
    updateStatus(keyStatus, "Key generation failed", 'error');
    log(`Key generation error: ${error.message}`, 'error');
  } finally {
    removeLoadingState(generateKeysBtn);
  }
}

// Export public key
async function exportPublicKey() {
  try {
    const keyBuffer = await crypto.subtle.exportKey("spki", publicKey);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(keyBuffer)));
    const pem = `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;
    
    const blob = new Blob([pem], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "public_key.pem";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log("Public key exported as PEM file", 'success');
    
  } catch (error) {
    log(`Public key export error: ${error.message}`, 'error');
  }
}

// Image signing
signImageBtn.addEventListener("click", signImage);

async function signImage() {
  if (!imageBuffer || !privateKey) {
    log("Load an image and generate keys first", 'warning');
    return;
  }
  
  try {
    addLoadingState(signImageBtn);
    updateStatus(signStatus, "Signing image...");
    
    signature = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      privateKey,
      imageBuffer
    );
    
    updateStatus(signStatus, "Image signed successfully", 'success');
    updateButtonStates();
    
    log("Image signed with RSA private key", 'success');
    
  } catch (error) {
    updateStatus(signStatus, "Signing failed", 'error');
    log(`Signing error: ${error.message}`, 'error');
  } finally {
    removeLoadingState(signImageBtn);
  }
}

// Signature verification
verifyBtn.addEventListener("click", verifySignature);

async function verifySignature() {
  if (!signature || !publicKey || !imageBuffer) {
    log("Missing signature, public key, or image", 'warning');
    return;
  }
  
  try {
    addLoadingState(verifyBtn);
    updateStatus(verifyStatus, "Verifying signature...");
    
    const isValid = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      publicKey,
      signature,
      imageBuffer
    );
    
    if (isValid) {
      updateStatus(verifyStatus, "Signature is valid", 'success');
      log("Signature verification: VALID", 'success');
    } else {
      updateStatus(verifyStatus, "Signature is invalid", 'error');
      log("Signature verification: INVALID", 'error');
    }
    
  } catch (error) {
    updateStatus(verifyStatus, "Verification failed", 'error');
    log(`Verification error: ${error.message}`, 'error');
  } finally {
    removeLoadingState(verifyBtn);
  }
}

// Download signature
downloadSigBtn.addEventListener("click", downloadSignature);

function downloadSignature() {
  if (!signature) {
    log("No signature to download", 'warning');
    return;
  }
  
  try {
    const blob = new Blob([signature], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `${imageFileName?.split('.')[0] || 'image'}_signature.sig`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log("Signature file downloaded", 'success');
    
  } catch (error) {
    log(`Download error: ${error.message}`, 'error');
  }
}

// Embed signature in PNG
embedSigBtn.addEventListener("click", embedSignatureInImage);

async function embedSignatureInImage() {
  if (!signature || !imageBuffer) {
    log("No signature or image available", 'warning');
    return;
  }
  
  if (!imageFileName?.toLowerCase().endsWith('.png')) {
    log("Signature embedding only supported for PNG files", 'warning');
    return;
  }
  
  try {
    addLoadingState(embedSigBtn);
    
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const pngBytes = new Uint8Array(imageBuffer);
    
    // Create PNG text chunk for signature
    const textChunk = createPNGTextChunk("Digital-Signature", base64Signature);
    
    // Insert the text chunk after the PNG header and IHDR chunk
    const newImageSize = pngBytes.length + textChunk.length;
    const newImage = new Uint8Array(newImageSize);
    
    // Copy PNG signature and IHDR (first 33 bytes typically)
    const ihdrEnd = findIHDREnd(pngBytes);
    newImage.set(pngBytes.subarray(0, ihdrEnd));
    
    // Insert our signature chunk
    newImage.set(textChunk, ihdrEnd);
    
    // Copy the rest of the PNG
    newImage.set(pngBytes.subarray(ihdrEnd), ihdrEnd + textChunk.length);
    
    // Download the modified PNG
    const blob = new Blob([newImage], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `signed_${imageFileName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log("Signature embedded in PNG metadata", 'success');
    
  } catch (error) {
    log(`Embedding error: ${error.message}`, 'error');
  } finally {
    removeLoadingState(embedSigBtn);
  }
}

// PNG utility functions
function findIHDREnd(pngBytes) {
  // PNG signature is 8 bytes, then IHDR chunk
  // IHDR chunk: 4 bytes length + 4 bytes type + data + 4 bytes CRC
  const ihdrLength = new DataView(pngBytes.buffer, 8, 4).getUint32(0);
  return 8 + 4 + 4 + ihdrLength + 4; // signature + length + type + data + crc
}

function createPNGTextChunk(keyword, text) {
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  
  chunkData.set(keywordBytes);
  chunkData[keywordBytes.length] = 0; // null separator
  chunkData.set(textBytes, keywordBytes.length + 1);
  
  // Create CRC table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  
  // Calculate CRC32
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }
  
  const chunkType = new TextEncoder().encode("tEXt");
  const chunk = new Uint8Array(8 + chunkData.length + 4);
  const view = new DataView(chunk.buffer);
  
  // Write chunk length
  view.setUint32(0, chunkData.length);
  
  // Write chunk type
  chunk.set(chunkType, 4);
  
  // Write chunk data
  chunk.set(chunkData, 8);
  
  // Calculate and write CRC
  const crcData = new Uint8Array([...chunkType, ...chunkData]);
  const crc = crc32(crcData);
  view.setUint32(8 + chunkData.length, crc);
  
  return chunk;
}

// Import handlers
publicKeyImport.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const pemText = await file.text();
    const base64 = pemText.replace(/-----.*-----|\n|\r/g, "");
    const der = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    
    publicKey = await crypto.subtle.importKey(
      "spki",
      der.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"]
    );
    
    updateStatus(keyStatus, "Public key imported", 'success');
    updateButtonStates();
    log(`Public key imported from ${file.name}`, 'success');
    
  } catch (error) {
    log(`Public key import error: ${error.message}`, 'error');
  }
});

signatureImport.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    signature = await file.arrayBuffer();
    updateStatus(signStatus, "Signature imported", 'success');
    updateButtonStates();
    log(`Signature imported from ${file.name}`, 'success');
    
  } catch (error) {
    log(`Signature import error: ${error.message}`, 'error');
  }
});

// Console clear
clearConsoleBtn.addEventListener("click", () => {
  outputDiv.textContent = "";
  log("Console cleared", 'info');
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  log("Digital Image Signer initialized", 'success');
  updateButtonStates();
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'g':
        e.preventDefault();
        if (!generateKeysBtn.disabled) generateKeys();
        break;
      case 's':
        e.preventDefault();
        if (!signImageBtn.disabled) signImage();
        break;
      case 'v':
        e.preventDefault();
        if (!verifyBtn.disabled) verifySignature();
        break;
    }
  }
});