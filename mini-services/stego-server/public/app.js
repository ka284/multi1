// Secure Multimedia Steganography System

// Detect if running locally
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '';
const isStegoServer = window.location.port === '3030' || window.location.hostname.includes('192.168');

// Set API URL
let API_BASE = '/api';
if (isLocalhost && !isStegoServer) {
  API_BASE = 'http://localhost:3030/api';
}

// DOM elements
const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.theme-icon');

// File type configurations
const fileTypes = {
  image: {
    icon: '📷',
    label: 'Image',
    extension: '.png',
    contentType: 'image/png'
  },
  audio: {
    icon: '🎵',
    label: 'Audio',
    extension: '.wav',
    contentType: 'audio/wav'
  },
  video: {
    icon: '🎬',
    label: 'Video',
    extension: '.avi',
    contentType: 'video/x-msvideo'
  }
};

function getFilenameFromContentDisposition(headerValue) {
  if (!headerValue) return null;
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

  const asciiMatch = headerValue.match(/filename="([^"]+)"/i) || headerValue.match(/filename=([^;]+)/i);
  if (asciiMatch?.[1]) return asciiMatch[1].trim();

  return null;
}

// Detect file type from File object
function getFileType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'unknown';
}

// Theme functions
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'bright';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'bright';
  const newTheme = currentTheme === 'dark' ? 'bright' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// Page navigation
function showPage(pageName) {
  pages.forEach(page => {
    page.style.display = page.id === `${pageName}-page` ? 'block' : 'none';
  });
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });
}

// Password toggle
function togglePassword(targetId) {
  const input = document.getElementById(targetId);
  const btn = document.querySelector(`[data-target="${targetId}"]`);
  if (input && btn) {
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁️' : '🔒';
  }
}

// File upload preview
function setupFileUpload(isEncode) {
  const prefix = isEncode ? 'encode' : 'decode';
  const container = document.getElementById(`${prefix}FileUpload`);
  const placeholder = document.getElementById(`${prefix}UploadPlaceholder`);
  const previewContainer = document.getElementById(`${prefix}PreviewContainer`);
  const input = document.getElementById(`${prefix}File`);

  if (!container || !input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = (event) => {
      // Hide all previews first
      ['Image', 'Audio', 'Video'].forEach(mediaType => {
        const preview = document.getElementById(`${prefix}${mediaType}Preview`);
        if (preview) {
          preview.style.display = 'none';
          preview.src = '';
        }
      });

      // Detect file type and show appropriate preview
      const fileType = getFileType(file);
      let previewElement;
      
      if (fileType === 'image') {
        previewElement = document.getElementById(`${prefix}ImagePreview`);
        previewElement.src = event.target.result;
      } else if (fileType === 'audio') {
        previewElement = document.getElementById(`${prefix}AudioPreview`);
        previewElement.src = event.target.result;
      } else if (fileType === 'video') {
        previewElement = document.getElementById(`${prefix}VideoPreview`);
        previewElement.src = event.target.result;
      }

      if (previewElement) {
        previewElement.style.display = 'block';
        previewContainer.style.display = 'block';
        placeholder.style.display = 'none';
      }
    };
    
    reader.readAsDataURL(file);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.classList.add('dragover');
  });

  container.addEventListener('dragleave', () => {
    container.classList.remove('dragover');
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    container.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

// Show result message
function showResult(id, success, message) {
  const card = document.getElementById(id);
  const icon = card.querySelector('.result-icon');
  const msg = card.querySelector('.result-message');
  
  card.className = 'result-card ' + (success ? 'success' : 'error');
  icon.textContent = success ? '✅' : '❌';
  msg.textContent = message;
  card.style.display = 'block';
}

// Encode function
async function encode(e) {
  e.preventDefault();
  
  const btn = document.getElementById('encodeBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');
  
  hideResult('encodeResult');
  document.getElementById('stegoResult').style.display = 'none';
  
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  try {
    let url = `${API_BASE}/encode`;
    if (!isLocalhost && !isStegoServer) url += '?XTransformPort=3030';

    const response = await fetch(url, {
      method: 'POST',
      body: new FormData(e.target)
    });

    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('content-disposition');
      const serverFilename = getFilenameFromContentDisposition(contentDisposition);
      
      // Get file type from the uploaded file
      const fileInput = document.getElementById('encodeFile');
      const fileType = fileInput.files[0] ? getFileType(fileInput.files[0]) : 'image';
      const config = fileTypes[fileType] || fileTypes.image;
      
      // Hide all stego previews
      ['stegoImage', 'stegoAudio', 'stegoVideo'].forEach(id => {
        document.getElementById(id).style.display = 'none';
      });
      
      // Show appropriate preview
      let previewElement;
      if (fileType === 'image') {
        previewElement = document.getElementById('stegoImage');
        previewElement.src = blobUrl;
      } else if (fileType === 'audio') {
        previewElement = document.getElementById('stegoAudio');
        previewElement.src = blobUrl;
      } else if (fileType === 'video') {
        previewElement = document.getElementById('stegoVideo');
        previewElement.src = blobUrl;
      }
      
      if (previewElement) {
        previewElement.style.display = 'block';
      }
      
      // Update title and description
      document.getElementById('stegoTitle').textContent = `Stego ${config.label} Ready`;
      document.getElementById('stegoDescription').textContent = 
        `Your message has been encrypted and hidden in this ${config.label.toLowerCase()} using DES + AES encryption and LSB steganography.`;
      
      document.getElementById('stegoResult').style.display = 'block';
      
      document.getElementById('downloadStego').onclick = () => {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = serverFilename || `stego_${Date.now()}${config.extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      
      showResult('encodeResult', true, 'Message encoded successfully!');
    } else {
      const error = await response.json();
      showResult('encodeResult', false, error.error || 'Encoding failed');
    }
  } catch (error) {
    console.error(error);
    showResult('encodeResult', false, 'Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

// Decode function
async function decode(e) {
  e.preventDefault();
  
  const btn = document.getElementById('decodeBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');
  
  hideResult('decodeResult');
  document.getElementById('decodedMessageCard').style.display = 'none';
  
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  try {
    let url = `${API_BASE}/decode`;
    if (!isLocalhost && !isStegoServer) url += '?XTransformPort=3030';

    const response = await fetch(url, {
      method: 'POST',
      body: new FormData(e.target)
    });

    const data = await response.json();

    if (data.success) {
      document.getElementById('decodedMessage').textContent = data.message;
      document.getElementById('decodedMessageCard').style.display = 'block';
      showResult('decodeResult', true, 'Message decoded successfully!');
    } else {
      showResult('decodeResult', false, data.error || 'Decoding failed');
    }
  } catch (error) {
    console.error(error);
    showResult('decodeResult', false, 'Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

function hideResult(id) {
  document.getElementById(id).style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  themeToggle.addEventListener('click', toggleTheme);
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => showPage(e.target.dataset.page));
  });
  
  document.querySelectorAll('.hero-buttons .btn').forEach(btn => {
    btn.addEventListener('click', (e) => showPage(e.target.dataset.page));
  });
  
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => togglePassword(btn.dataset.target));
  });
  
  setupFileUpload(true);  // encode
  setupFileUpload(false); // decode
  
  document.getElementById('encodeForm').addEventListener('submit', encode);
  document.getElementById('decodeForm').addEventListener('submit', decode);
});
