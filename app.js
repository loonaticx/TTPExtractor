document.addEventListener('DOMContentLoaded', function () {
    const dropzone = document.getElementById('dropzone');
    const hexOutput = document.getElementById('hex-output');

    // Style hex output container to resize and provide space for the image thumbnail
    hexOutput.style.width = '60%'; // Resize to allow space for the thumbnail on the right
    hexOutput.style.float = 'left'; // Align hex output to the left

    // Create the container for the image preview
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.style.position = 'relative'; // Relative to body, bottom right location
    thumbnailContainer.style.float = 'right'; // Float to the right side of the body
    thumbnailContainer.style.width = '25%'; // Set initial width of the container
    thumbnailContainer.style.height = 'auto'; // Let height adjust based on content
    thumbnailContainer.style.padding = '10px';
    thumbnailContainer.style.border = '1px solid #ccc';
    thumbnailContainer.style.backgroundColor = '#f9f9f9';
    thumbnailContainer.style.textAlign = 'center';
    thumbnailContainer.style.resize = 'both'; // Make the container resizable
    thumbnailContainer.style.overflow = 'auto'; // Ensure overflow content is visible

    const thumbnailCaption = document.createElement('p');
    thumbnailCaption.textContent = 'Content Pack Thumbnail';
    thumbnailCaption.style.fontSize = '12px';
    thumbnailCaption.style.color = '#666';
    thumbnailContainer.appendChild(thumbnailCaption);

    document.body.appendChild(thumbnailContainer); // Append the container to the body

    dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.style.borderColor = '#000';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '#aaa';
    });

    dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.style.borderColor = '#aaa';

        const file = event.dataTransfer.files[0];
        if (file) {
            readFileAndProcess(file);
        }
    });

    function readFileAndProcess(file) {
        const reader = new FileReader();

        reader.onload = function (event) {
            const arrayBuffer = event.target.result;
            const bytes = new Uint8Array(arrayBuffer);

            // Check file header (first 3 bytes)
            const fileHeader = new TextDecoder().decode(bytes.slice(0, 3));
            if (fileHeader !== 'CPC' && fileHeader !== 'TTP') {
                hexOutput.textContent = 'This file is not a valid content pack file.';
                return;
            }

            // Record the version (the next byte after the header)
            const version = bytes[3];
            hexOutput.textContent = `File Header: ${fileHeader}\nVersion: ${version}\n`;

            // Search for the first image instance (before any other processing)
            const imageBytes = extractImageFromBytes(bytes);
            if (imageBytes) {
                displayImage(imageBytes);
            } else {
                hexOutput.textContent += 'No image found in the input file.\n';
            }

            // Search for the byte sequence: 70 6D 66 00 0A 0D
            const sequence = [0x70, 0x6D, 0x66, 0x00, 0x0A, 0x0D];
            const seekPosition = findByteSequence(bytes, sequence);

            if (seekPosition !== -1) {
                // If the sequence is found, extract all data from that point to the end of the file
                const extractedData = bytes.slice(seekPosition);

                // Handle TTP-specific data validation
                if (fileHeader === 'TTP') {
                    const ttpCheckBytes = [0x70, 0x6D, 0x66, 0x00, 0x0A, 0x0D, 0x01, 0x00, 0x01, 0x00, 0x01];
                    if (!checkTTPHeader(extractedData, ttpCheckBytes)) {
                        // Modify the extracted data to match the required pattern if it doesn't match
                        modifyTTPHeader(extractedData, ttpCheckBytes);
                    }
                }

                // Provide a download button to save the extracted data with a ".mf" extension
                createDownloadButton(extractedData, file.name);
            } else {
                hexOutput.textContent += '\nThe specified byte sequence was not found.';
            }
        };

        reader.onerror = function () {
            hexOutput.textContent = 'Error reading file.';
        };

        reader.readAsArrayBuffer(file);
    }

    function findByteSequence(bytes, sequence) {
        // Search for the sequence [0x70, 0x6D, 0x66, 0x00, 0x0A, 0x0D] in the byte array
        for (let i = 0; i <= bytes.length - sequence.length; i++) {
            let match = true;
            for (let j = 0; j < sequence.length; j++) {
                if (bytes[i + j] !== sequence[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                return i; // Return the index where the sequence starts
            }
        }
        return -1; // Sequence not found
    }

    function checkTTPHeader(extractedData, ttpCheckBytes) {
        // Check if the first 11 bytes of the extracted data match the expected TTP header bytes
        for (let i = 0; i < ttpCheckBytes.length; i++) {
            if (extractedData[i] !== ttpCheckBytes[i]) {
                return false;
            }
        }
        return true;
    }

    function modifyTTPHeader(extractedData, ttpCheckBytes) {
        // Modify the first 11 bytes of the extracted data to match the required TTP pattern
        for (let i = 0; i < ttpCheckBytes.length; i++) {
            extractedData[i] = ttpCheckBytes[i];
        }
    }

    function createDownloadButton(data, originalFileName) {
        // Create a Blob from the extracted data
        const blob = new Blob([data], { type: 'application/octet-stream' });

        // Create a download link
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = originalFileName.replace(/\.[^/.]+$/, "") + ".mf"; // Change the file extension to ".mf"

        // Create a button for downloading
        downloadLink.textContent = 'Download Extracted .mf File';
        downloadLink.style.display = 'block';
        downloadLink.style.marginTop = '20px';

        // Append the button to the hexOutput div
        hexOutput.appendChild(downloadLink);
    }

    function extractImageFromBytes(byteArray) {
        // PNG signature: 0x89 50 4E 47 0D 0A 1A 0A
        const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        // JPEG signature: 0xFF D8 FF
        const jpegSignature = [0xFF, 0xD8, 0xFF];

        let imageIndex = -1;
        let isPng = false;

        // Search for the PNG or JPEG signature in the input file data
        for (let i = 0; i < byteArray.length - pngSignature.length; i++) {
            // Check for PNG signature
            if (checkSignature(byteArray, i, pngSignature)) {
                imageIndex = i;
                isPng = true;
                break;
            }
            // Check for JPEG signature
            if (checkSignature(byteArray, i, jpegSignature)) {
                imageIndex = i;
                isPng = false;
                break;
            }
        }

        if (imageIndex === -1) {
            return null; // No image found
        }

        // Extract all bytes starting from the image signature
        const extractedBytes = byteArray.slice(imageIndex);

        // Return the extracted image bytes (either PNG or JPEG)
        return { bytes: extractedBytes, type: isPng ? 'image/png' : 'image/jpeg' };
    }

    function checkSignature(byteArray, startIndex, signature) {
        for (let i = 0; i < signature.length; i++) {
            if (byteArray[startIndex + i] !== signature[i]) {
                return false;
            }
        }
        return true;
    }

    function displayImage(imageData) {
        // Create a blob URL for the extracted image (PNG or JPEG)
        const blob = new Blob([imageData.bytes], { type: imageData.type });
        const imageUrl = URL.createObjectURL(blob);

        // Create an img element for the image
        const imageElement = document.createElement('img');
        imageElement.src = imageUrl;
        imageElement.alt = 'Extracted Image';
        imageElement.style.maxWidth = '100%'; // Allow resizable container to control width
        imageElement.style.maxHeight = '100%'; // Allow resizable container to control height

        // Clear previous image and append the new image
        thumbnailContainer.innerHTML = '';
        thumbnailContainer.appendChild(thumbnailCaption); // Re-append the caption
        thumbnailContainer.appendChild(imageElement);
        thumbnailContainer.style.display = 'block'; // Make the container visible
    }
});
