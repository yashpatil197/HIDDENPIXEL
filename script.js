// --- GLOBAL ELEMENTS ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// State
let coverImageLoaded = false;
let secretFileLoaded = false;
let secretFileBuffer = null;
let secretFileName = "";

// --- EVENT LISTENERS ---

// 1. Handle Cover Image Upload
document.getElementById('upload-cover').addEventListener('change', function(e) {
    handleImageUpload(e.target.files[0], 'preview-cover', true);
});

// 2. Handle Secret File Upload
document.getElementById('upload-secret').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    
    secretFileName = file.name;
    const reader = new FileReader();
    reader.onload = function(evt) {
        secretFileBuffer = evt.target.result; // This is an ArrayBuffer
        secretFileLoaded = true;
        document.getElementById('file-info').innerText = `Selected: ${file.name} (${formatBytes(file.size)})`;
        checkCapacity();
    };
    reader.readAsArrayBuffer(file);
});

// 3. Handle Decode Image Upload
document.getElementById('upload-decode').addEventListener('change', function(e) {
    handleImageUpload(e.target.files[0], 'preview-decode', false);
});

// Buttons
document.getElementById('encode-btn').addEventListener('click', encodeProcess);
document.getElementById('decode-btn').addEventListener('click', decodeProcess);


// --- CORE LOGIC ---

function handleImageUpload(file, imgId, isEncode) {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.getElementById(imgId);
        img.src = e.target.result;
        img.style.display = 'block';
        img.onload = function() {
            if(isEncode) {
                coverImageLoaded = true;
                checkCapacity();
            } else {
                document.getElementById('decode-btn').disabled = false;
            }
        }
    }
    reader.readAsDataURL(file);
}

function checkCapacity() {
    if (!coverImageLoaded || !secretFileLoaded) return;
    
    const img = document.getElementById('preview-cover');
    const totalPixels = img.naturalWidth * img.naturalHeight;
    const totalBitsAvailable = totalPixels * 3; // R, G, B channels
    
    // Calculate required bits: Header + File Data
    // Header estimate: 100 bytes * 8 bits
    const fileBits = secretFileBuffer.byteLength * 8;
    const requiredBits = fileBits + 800; 

    const percent = (requiredBits / totalBitsAvailable) * 100;
    
    const fill = document.getElementById('capacity-fill');
    const text = document.getElementById('capacity-text');
    const btn = document.getElementById('encode-btn');

    fill.style.width = percent + "%";
    text.innerText = `${percent.toFixed(2)}% Capacity Used`;

    if (percent > 100) {
        fill.style.background = "red";
        text.innerText = "File too big for this image!";
        btn.disabled = true;
    } else {
        fill.style.background = "#10b981";
        btn.disabled = false;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- ENCODE ALGORITHM (BINARY) ---

function encodeProcess() {
    const password = document.getElementById('pass-encode').value;
    const img = document.getElementById('preview-cover');
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    // 1. Prepare Data Header: FILENAME|FILESIZE|
    // We separate metadata with a pipe symbol "|"
    let header = `${secretFileName}|${secretFileBuffer.byteLength}|`;
    
    // 2. Convert Header to Binary String
    let binaryStream = "";
    for (let i = 0; i < header.length; i++) {
        binaryStream += header.charCodeAt(i).toString(2).padStart(8, '0');
    }

    // 3. Convert File Buffer to Binary String
    const uint8View = new Uint8Array(secretFileBuffer);
    for (let i = 0; i < uint8View.length; i++) {
        let byte = uint8View[i];
        // Apply Simple XOR Encryption if password exists
        if(password) {
            byte = byte ^ password.charCodeAt(i % password.length);
        }
        binaryStream += byte.toString(2).padStart(8, '0');
    }

    // 4. Write to Image LSB
    let dataIndex = 0;
    for (let i = 0; i < binaryStream.length; i++) {
        // Skip Alpha (Every 4th byte)
        if ((dataIndex + 1) % 4 === 0) dataIndex++;

        let bit = binaryStream[i];
        // Clear LSB and set new bit
        pixels[dataIndex] = (pixels[dataIndex] & 254) | parseInt(bit);
        dataIndex++;
    }

    // 5. Update Canvas & Download
    ctx.putImageData(imgData, 0, 0);
    
    const link = document.createElement('a');
    link.download = 'stegavault_secure.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
}


// --- DECODE ALGORITHM (BINARY) ---

function decodeProcess() {
    const password = document.getElementById('pass-decode').value;
    const img = document.getElementById('preview-decode');
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    let binaryStream = "";
    let extractedChars = "";
    let headerParts = [];
    let fileLen = 0;
    let fileName = "";
    let metadataRead = false;
    let pixelIdx = 0;

    // 1. Extract Header First
    // We loop until we find two "|" symbols
    while (!metadataRead && pixelIdx < pixels.length) {
        if ((pixelIdx + 1) % 4 === 0) pixelIdx++; // Skip Alpha

        // Read LSB
        binaryStream += (pixels[pixelIdx] & 1).toString();
        pixelIdx++;

        if (binaryStream.length === 8) {
            let charCode = parseInt(binaryStream, 2);
            let char = String.fromCharCode(charCode);
            extractedChars += char;
            binaryStream = ""; // Reset for next byte

            // Check for separator
            if (char === '|') {
                headerParts.push(extractedChars.slice(0, -1)); // Store part minus pipe
                extractedChars = "";
                
                if (headerParts.length === 2) {
                    // We found both parts: Name and Size
                    fileName = headerParts[0];
                    fileLen = parseInt(headerParts[1]);
                    metadataRead = true;
                }
            }
        }
    }

    // 2. Extract File Data based on size
    const resultBytes = new Uint8Array(fileLen);
    let currentByte = 0;
    
    // Reset binary stream for file data
    binaryStream = ""; 

    while (currentByte < fileLen && pixelIdx < pixels.length) {
        if ((pixelIdx + 1) % 4 === 0) pixelIdx++;

        binaryStream += (pixels[pixelIdx] & 1).toString();
        pixelIdx++;

        if (binaryStream.length === 8) {
            let byteVal = parseInt(binaryStream, 2);
            
            // Decrypt if password provided
            if(password) {
                byteVal = byteVal ^ password.charCodeAt(currentByte % password.length);
            }

            resultBytes[currentByte] = byteVal;
            currentByte++;
            binaryStream = "";
        }
    }

    // 3. Create Download
    document.getElementById('result-area').style.display = 'block';
    document.getElementById('found-filename').innerText = fileName;
    
    const downloadBtn = document.getElementById('download-secret-btn');
    downloadBtn.onclick = function() {
        const blob = new Blob([resultBytes], {type: "application/octet-stream"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName; // Use original filename!
        a.click();
        URL.revokeObjectURL(url);
    };
}
