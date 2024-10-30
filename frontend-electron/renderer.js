const axios = require('axios');
const { ipcRenderer } = require('electron');
    
const BASE_URL = 'http://localhost:3000';

// Select DOM elements
const uploadSection = document.getElementById('upload-section');
const receiveSection = document.getElementById('receive-section');
const uploadBtn = document.getElementById('upload-btn');
const receiveBtn = document.getElementById('receive-btn')
const fileUpload = document.getElementById('file-upload');
const fileList = document.getElementById('file-list');

// uploadBtn.addEventListener('click', async () => {
//     const receivers = document.getElementById('receivers').value.split(',');
//     const files = fileUpload.files;
//     const formData = new FormData();
    
//     for (let i = 0; i < files.length; i++) {
//         formData.append('files', files[i]);
//     }
//     formData.append('receivers', JSON.stringify(receivers));

//     try {
//         const response = await axios.post(`${BASE_URL}/upload`, formData, {
//             headers: { 'Authorization': `Bearer ${authToken}` }
//         });
//         alert('Files uploaded successfully!');
//     } catch (error) {
//         alert('File upload failed! ' + error.response.data.msg);
//     }
// });


// // receiveBtn.addEventListener('click', async () => {
// //     try {
// //         const response = await axios.post(`${BASE_URL}/receive`, {}, {
// //             headers: { 'Authorization': `Bearer ${authToken}` }
// //         });

// //         fileList.innerHTML = ''; // Clear existing list
// //         const files = response.data.files;
// //         files.forEach(file => {
// //             const listItem = document.createElement('li');
// //             listItem.textContent = file.filename;
// //             fileList.appendChild(listItem);

// //             // Add PDF viewing functionality
// //             listItem.addEventListener('click', async () => {
// //                 try {
// //                     const fileResponse = await axios.get(`${BASE_URL}/download/${file.filename}`, {
// //                         headers: { 'Authorization': `Bearer ${authToken}` },
// //                         responseType: 'blob' // Fetch as a Blob
// //                     });
                    
// //                     // Convert Blob to a base64 data URL and send to main process
// //                     const reader = new FileReader();
// //                     reader.onloadend = () => {
// //                         const pdfDataUrl = reader.result;
// //                         console.log(pdfDataUrl);
// //                         ipcRenderer.send('open-pdf-viewer', pdfDataUrl);
// //                     };
// //                     reader.readAsDataURL(fileResponse.data);
                    
// //                 } catch (error) {
// //                     alert('Failed to load PDF: ' + error.message);
// //                 }
// //             });
// //         });
// //     } catch (error) {
// //         alert('Failed to receive files! ' + error.response.data.msg);
// //     }
// // });

// receiveBtn.addEventListener('click', async () => {
//     try {
//         const response = await axios.post(`${BASE_URL}/receive`, {}, {
//             headers: { 'Authorization': `Bearer ${authToken}` }
//         });

//         fileList.innerHTML = ''; // Clear existing list
//         const files = response.data.files;
//         files.forEach(file => {
//             const listItem = document.createElement('li');
//             listItem.textContent = file.filename;
//             fileList.appendChild(listItem);
            
//             // Add download functionality
//             listItem.addEventListener('click', async () => {
//                 const downloadLink = document.createElement('a');
//                 downloadLink.href = `${BASE_URL}/download/${file.filename}`;
//                 downloadLink.download = file.filename;
//                 document.body.appendChild(downloadLink);
//                 downloadLink.click();
//                 document.body.removeChild(downloadLink);
//             });
//         });
//     } catch (error) {
//         alert('Failed to receive files! ' + error.response.data.msg);
//     }
// });

// ['keydown', 'click'].forEach(e => { // Changed 'event' to 'evt'
//     window.addEventListener(e, () => { 
//         console.log('Activity detected:', e); // Debug log 
//         ipcRenderer.send('user-active'); 
//     }); 
// });

