// Global Variables
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- EVENT LISTENERS ---
document.getElementById('upload-encode').addEventListener('change', (e) => previewImage(e.target, 'preview-encode'));
document.getElementById('encode-btn').addEventListener('click', encodeMessage);
document.getElementById('decode-btn').addEventListener('click', decodeMessage);

// --- HELPER FUNCTIONS ---

function previewImage(input, imgId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById(imgId);
            img.src = e.target.result;
            img.style.display = 'block';
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// THE NEW LOGIC: XOR ENCRYPTION
// This mimics C-style bitwise manipulation
function xorCipher(text, password) {
    // If no password provided, return raw text
    if (!password || password.length === 0) return text;

    let result = "";
    for (let i = 0; i < text.length; i++) {
        // Get ASCII codes
        const charCode = text.charCodeAt(i);
        const passCode = password.charCodeAt(i % password.length); // Loop password
        
        // Bitwise XOR (^) to scramble/unscramble
        const xorValue = charCode ^ passCode;
        
        result += String.fromCharCode(xorValue);
    }
    return result;
}

// --- ENCODING ---
function encodeMessage() {
    const fileInput = document.getElementById('upload-encode');
    const message = document.getElementById('secret-text').value;
    const password = document.getElementById('pass-encode').value; // Get Password

    if (!fileInput.files[0] || !message) {
        alert("Please select an image and enter text.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // 1. ENCRYPT MESSAGE BEFORE HIDING
            // Note: We encrypt the text, THEN add the terminator ($) so we can always find the end.
            const encryptedText = xorCipher(message, password);
            const fullMessage = encryptedText + "$"; 
            
            // Convert to Binary
            let binaryMessage = "";
            for (let i = 0; i < fullMessage.length; i++) {
                let binaryChar = fullMessage[i].charCodeAt(0).toString(2).padStart(8, '0');
                binaryMessage += binaryChar;
            }

            if (binaryMessage.length > data.length / 4) {
                alert("Text is too long for this image size!");
                return;
            }

            // Hide Bits
            let dataIndex = 0;
            for (let i = 0; i < binaryMessage.length; i++) {
                let bit = binaryMessage[i]; 
                data[dataIndex] = (data[dataIndex] & 254) | parseInt(bit);
                dataIndex++;
                if ((dataIndex + 1) % 4 === 0) dataIndex++;
            }

            ctx.putImageData(imgData, 0, 0);

            const link = document.createElement('a');
            link.download = 'secure-image.png'; // Updated filename
            link.href = canvas.toDataURL("image/png");
            link.click();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(fileInput.files[0]);
}

// --- DECODING ---
function decodeMessage() {
    const fileInput = document.getElementById('upload-decode');
    const password = document.getElementById('pass-decode').value; // Get Password
    
    if (!fileInput.files[0]) {
        alert("Please upload the encoded PNG image.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            let binaryMessage = "";
            let extractedText = "";

            // Extract Bits
            for (let i = 0; i < data.length; i++) {
                if ((i + 1) % 4 === 0) continue;
                binaryMessage += (data[i] & 1).toString();
            }

            // Convert Binary to Text
            for (let i = 0; i < binaryMessage.length; i += 8) {
                let byte = binaryMessage.slice(i, i + 8);
                let charCode = parseInt(byte, 2);
                let char = String.fromCharCode(charCode);

                if (char === "$") break; // Stop at terminator
                
                extractedText += char;
                if (extractedText.length > 50000) break;
            }

            // 2. DECRYPT MESSAGE AFTER EXTRACTING
            // If the password is wrong, this will result in garbage text!
            const finalMessage = xorCipher(extractedText, password);

            const resultBox = document.getElementById('decoded-result');
            resultBox.innerText = finalMessage;
            resultBox.style.display = 'block';
            
            // Visual feedback if result looks like garbage (optional simple check)
            if(finalMessage.length > 0 && password.length > 0) {
                 resultBox.style.borderLeftColor = "#00ff88"; // Green success indicator
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(fileInput.files[0]);
}
