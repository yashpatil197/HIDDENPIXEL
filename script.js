// Global Variables
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- EVENT LISTENERS ---

// 1. Preview Image on Upload
document.getElementById('upload-encode').addEventListener('change', function(e) {
    previewImage(e.target, 'preview-encode');
});

// 2. Trigger Encode Function
document.getElementById('encode-btn').addEventListener('click', encodeMessage);

// 3. Trigger Decode Function
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


// --- MAIN ENCODING LOGIC (The "Bitwise" Part) ---

function encodeMessage() {
    const fileInput = document.getElementById('upload-encode');
    const message = document.getElementById('secret-text').value;

    if (!fileInput.files[0] || !message) {
        alert("Please select an image and enter text.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Setup Canvas
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Get Raw Pixel Data
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // Prepare Message with Terminator '$'
            const fullMessage = message + "$"; 
            
            // Convert to Binary String
            let binaryMessage = "";
            for (let i = 0; i < fullMessage.length; i++) {
                let binaryChar = fullMessage[i].charCodeAt(0).toString(2).padStart(8, '0');
                binaryMessage += binaryChar;
            }

            // Check Capacity
            if (binaryMessage.length > data.length / 4) {
                alert("Text is too long for this image size!");
                return;
            }

            // EMBED BITS: Modify Least Significant Bit (LSB)
            let dataIndex = 0;
            for (let i = 0; i < binaryMessage.length; i++) {
                let bit = binaryMessage[i]; 
                
                // Bitwise Logic: (val & 254) clears last bit, | bit sets it
                data[dataIndex] = (data[dataIndex] & 254) | parseInt(bit);
                
                dataIndex++;
                
                // Skip Alpha Channel (Every 4th byte)
                if ((dataIndex + 1) % 4 === 0) {
                    dataIndex++;
                }
            }

            // Write modified data back to canvas
            ctx.putImageData(imgData, 0, 0);

            // Trigger Download
            const link = document.createElement('a');
            link.download = 'hidden-pixel-image.png';
            link.href = canvas.toDataURL("image/png");
            link.click();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(fileInput.files[0]);
}


// --- MAIN DECODING LOGIC ---

function decodeMessage() {
    const fileInput = document.getElementById('upload-decode');
    
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
            let decodedText = "";

            // Extract Bits
            for (let i = 0; i < data.length; i++) {
                // Skip Alpha
                if ((i + 1) % 4 === 0) continue;

                // Bitwise Logic: data[i] & 1 gets the last bit
                binaryMessage += (data[i] & 1).toString();
            }

            // Convert Binary to Text
            for (let i = 0; i < binaryMessage.length; i += 8) {
                let byte = binaryMessage.slice(i, i + 8);
                let charCode = parseInt(byte, 2);
                let char = String.fromCharCode(charCode);

                if (char === "$") {
                    break; // Stop at terminator
                }
                decodedText += char;

                if (decodedText.length > 50000) break; // Safety break
            }

            // Show Result
            const resultBox = document.getElementById('decoded-result');
            resultBox.innerText = decodedText;
            resultBox.style.display = 'block';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(fileInput.files[0]);
}
