import './styles.css';

// --- Веб-компонент для выпадающего списка ---
class TemplateDropdown extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this._options = [];
        this._selected = 0;
        this._error = false;
    }
    set options(val) {
        this._options = val;
        this._error = false;
        this.render();
    }
    set selected(idx) {
        this._selected = idx;
        this.render();
    }
    set error(val) {
        this._error = val;
        this.render();
    }
    get selected() {
        return this._selected;
    }
    connectedCallback() {
        this.render();
        this.shadowRoot.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT') {
                this._selected = e.target.selectedIndex;
                this.setAttribute('data-selected', this._selected);
            }
        });
    }
    render() {
        if (this._error || this._options.length === 0) {
            this.shadowRoot.innerHTML = `<style>select{width:120px;}</style><select disabled><option>ERROR</option></select>`;
        } else {
            let opts = this._options.map((tpl, idx) => `<option${this._selected === idx ? ' selected' : ''}>${tpl}</option>`).join('');
            this.shadowRoot.innerHTML = `<style>select{width:120px;}</style><select>${opts}</select>`;
        }
    }
}
customElements.define('template-dropdown', TemplateDropdown);

// --- Интерфейс приложения ---
const app = document.getElementById('app');
app.innerHTML = `
<div class="container">
    <div class="work-area">
        <div class="insert-panel">
            <button id="insertDropdownBtn">Insert</button>
        </div>
        <textarea id="editor"></textarea>
    </div>
    <div class="templates-panel">
        <div style="font-weight:bold; font-size:18px; margin-bottom:8px;">Templates</div>
        <ul class="templates-list" id="templatesList"></ul>
        <div class="template-controls">
            <button id="addTemplateBtn">+</button>
            <button id="removeTemplateBtn">-</button>
            <button id="exportTemplatesBtn" title="Экспорт шаблонов">⭳</button>
            <button id="importTemplatesBtn" title="Импорт шаблонов">⭱</button>
        </div>
        <div class="edit-template-label">Edit template:</div>
        <input type="text" id="editTemplateInput" class="edit-template-input" />
        <input type="file" id="importFileInput" accept="application/json" style="display:none" />
    </div>
</div>
`;

// --- Логика панели шаблонов ---
// Каждый шаблон: { title: string, content: string }
let templates = [
    { title: "template 1", content: "" },
    { title: "template 2", content: "" },
    { title: "template 3", content: "" },
];
let selectedTemplateIndex = 0;

// --- Хранилище состояний (localStorage) ---
const STORAGE_KEY = 'wysiwyg_templates_state_v2';
function saveState() {
    try {
        const payload = { templates, selectedTemplateIndex };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) { /* ignore */ }
}
function normalizeTemplates(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((item, idx) => {
        if (item && typeof item === 'object') {
            const title = typeof item.title === 'string' ? item.title : `template ${idx + 1}`;
            const content = typeof item.content === 'string' ? item.content : '';
            return { title, content };
        }
        // миграция со старого формата: строка = контент
        return { title: `template ${idx + 1}`, content: String(item ?? '') };
    });
}
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('wysiwyg_templates_state_v1');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.templates)) {
            templates = normalizeTemplates(parsed.templates);
        }
        if (Number.isInteger(parsed.selectedTemplateIndex)) {
            selectedTemplateIndex = Math.max(0, Math.min(parsed.selectedTemplateIndex, Math.max(templates.length - 1, 0)));
        }
    } catch (_) { /* ignore */ }
}

const templatesList = document.getElementById('templatesList');
const addTemplateBtn = document.getElementById('addTemplateBtn');
const removeTemplateBtn = document.getElementById('removeTemplateBtn');
const editTemplateInput = document.getElementById('editTemplateInput');
const insertDropdownBtn = document.getElementById('insertDropdownBtn');
const exportTemplatesBtn = document.getElementById('exportTemplatesBtn');
const importTemplatesBtn = document.getElementById('importTemplatesBtn');
const importFileInput = document.getElementById('importFileInput');

// загрузка состояния перед первым рендером
loadState();

function renderTemplates() {
    templatesList.innerHTML = '';
    templates.forEach((tpl, idx) => {
        const li = document.createElement('li');
        li.textContent = tpl && typeof tpl === 'object' ? (tpl.title || `template ${idx + 1}`) : String(tpl);
        li.className = idx === selectedTemplateIndex ? 'selected' : '';
        li.onclick = () => selectTemplate(idx);
        templatesList.appendChild(li);
    });
    const current = templates[selectedTemplateIndex];
    editTemplateInput.value = current ? current.title || '' : '';
    removeTemplateBtn.disabled = templates.length === 0;
    updateAllDropdowns();
}

function selectTemplate(idx) {
    selectedTemplateIndex = idx;
    renderTemplates();
    saveState();
    // --- Подгружаем содержимое шаблона в редактор ---
    const editor = window.tinymce && tinymce.get('editor');
    if (editor && templates[selectedTemplateIndex] != null) {
        editor.setContent(templates[selectedTemplateIndex].content || '');
        setTimeout(updateAllDropdowns, 0);
    }
}

addTemplateBtn.onclick = function() {
    templates.push({ title: 'template', content: '' });
    selectedTemplateIndex = templates.length - 1;
    renderTemplates();
    editTemplateInput.focus();
    saveState();
};

removeTemplateBtn.onclick = function() {
    if (templates.length === 0) return;
    templates.splice(selectedTemplateIndex, 1);
    if (selectedTemplateIndex >= templates.length) {
        selectedTemplateIndex = templates.length - 1;
    }
    if (selectedTemplateIndex < 0) selectedTemplateIndex = 0;
    renderTemplates();
    saveState();
};

editTemplateInput.oninput = function() {
    if (templates.length === 0) return;
    const t = templates[selectedTemplateIndex];
    if (!t) return;
    t.title = editTemplateInput.value;
    renderTemplates();
    saveState();
};

editTemplateInput.onblur = function() {
    renderTemplates();
};

editTemplateInput.onkeydown = function(e) {
    if (e.key === 'Enter') {
        editTemplateInput.blur();
    }
};

// экспорт/импорт шаблонов
exportTemplatesBtn.onclick = function() {
    const data = JSON.stringify({ templates, selectedTemplateIndex }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'templates.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
};
importTemplatesBtn.onclick = function() {
    importFileInput.click();
};
importFileInput.onchange = function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result || ''));
            if (!parsed || !Array.isArray(parsed.templates)) return;
            templates = normalizeTemplates(parsed.templates);
            selectedTemplateIndex = Number.isInteger(parsed.selectedTemplateIndex) ? parsed.selectedTemplateIndex : 0;
            if (templates.length === 0) selectedTemplateIndex = 0;
            selectedTemplateIndex = Math.max(0, Math.min(selectedTemplateIndex, Math.max(templates.length - 1, 0)));
            renderTemplates();
            saveState();
            const editor = window.tinymce && tinymce.get('editor');
            if (editor) {
                const t = templates[selectedTemplateIndex];
                editor.setContent((t && t.content) || '');
            }
            setTimeout(updateAllDropdowns, 0);
        } catch (_) { /* ignore */ }
    };
    reader.readAsText(file);
    e.target.value = '';
};

// --- TinyMCE интеграция с веб-компонентом ---
function getDropdownHtml(selectedValue) {
    return `<template-dropdown contenteditable="false" data-selected="${selectedValue ?? 0}"></template-dropdown>&nbsp;`;
}

function updateAllDropdowns() {
    if (!window.tinymce) return;
    const editor = tinymce.get('editor');
    if (!editor) return;
    editor.getBody().querySelectorAll('template-dropdown').forEach(el => {
        let idx = parseInt(el.getAttribute('data-selected')) || 0;
        if (templates.length === 0 || idx >= templates.length) {
            el.error = true;
        } else {
            el.error = false;
            el.options = templates.map(t => t && typeof t === 'object' ? (t.title || '') : String(t));
            el.selected = idx;
        }
    });
}

insertDropdownBtn.onclick = function() {
    const editor = tinymce.get('editor');
    if (!editor) return;
    const html = getDropdownHtml(selectedTemplateIndex);
    editor.insertContent(html);
    setTimeout(updateAllDropdowns, 100);
};

// --- TinyMCE и обработка событий ---
window.addEventListener('DOMContentLoaded', () => {
    window.tinymce.init({
        selector: '#editor',
        height: 400,
        menubar: false,
        plugins: 'lists',
        toolbar: 'undo redo | bold italic underline | bullist numlist',
        setup: function (editor) {
            editor.on('keydown', function(e) {
                const rng = editor.selection.getRng();
                if (!rng.collapsed) return;
                let node = rng.startContainer;
                if (node.nodeType === 3) node = node.parentNode;
                if (node && node.tagName === 'TEMPLATE-DROPDOWN') {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        node.remove();
                    }
                }
            });
            editor.on('click', function(e) {
                let target = e.target;
                if (target && target.closest('template-dropdown')) {
                    let dropdown = target.closest('template-dropdown');
                    if (target.tagName === 'SELECT') {
                        let idx = target.selectedIndex;
                        dropdown.setAttribute('data-selected', idx);
                        dropdown.selected = idx;
                    }
                }
            });
            editor.on('init', function() {
                // Открыть сохранённый шаблон при запуске
                const t = templates[selectedTemplateIndex];
                editor.setContent((t && t.content) || '');
                updateAllDropdowns();
            });
            editor.on('SetContent', updateAllDropdowns);
            editor.on('Change', function() {
                updateAllDropdowns();
                // --- Автоматическое сохранение HTML редактора в выбранный шаблон ---
                if (templates.length > 0) {
                    const t = templates[selectedTemplateIndex];
                    if (t) t.content = editor.getContent();
                    renderTemplates();
                    saveState();
                }
            });
        }
    });
    setTimeout(updateAllDropdowns, 1000);
});

renderTemplates();
