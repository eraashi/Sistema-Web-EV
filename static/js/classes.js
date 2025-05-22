(function () {
    let classes = [];
    let disciplinas = [];

    const retryFetch = async (url, options, retries = 2, delay = 500) => {
        const cacheKey = `cache_${url}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 10000 && data && Array.isArray(data)) {
                    return data;
                } else {
                    localStorage.removeItem(cacheKey);
                }
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }

        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`Erro HTTP! Status: ${response.status}`);
                }
                const data = await response.json();
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
                } catch (e) {}
                return data;
            } catch (error) {
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    };

    async function fetchData() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = '<div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>';
        document.body.appendChild(overlay);

        const mainContent = document.querySelector('.mb-6');
        if (mainContent) {
            mainContent.classList.add('pointer-events-none');
        }

        try {
            classes = [];
            disciplinas = [];

            let isRendered = false;

            const cacheKeyDashboard = 'cache_/api/dashboard_data';
            const cachedDashboard = localStorage.getItem(cacheKeyDashboard);
            if (cachedDashboard) {
                try {
                    const { data, timestamp } = JSON.parse(cachedDashboard);
                    if (Date.now() - timestamp < 10000 && data && Array.isArray(data.turmas) && data.turmas.length > 0) {
                        classes = data.turmas;
                        isRendered = true;
                        renderClasses();
                    } else {
                        localStorage.removeItem(cacheKeyDashboard);
                    }
                } catch (e) {
                    localStorage.removeItem(cacheKeyDashboard);
                }
            }

            const cacheKeyDisciplinas = 'cache_/api/disciplinas';
            const cachedDisciplinas = localStorage.getItem(cacheKeyDisciplinas);
            if (cachedDisciplinas) {
                try {
                    const { data, timestamp } = JSON.parse(cachedDisciplinas);
                    if (Date.now() - timestamp < 10000 && data && Array.isArray(data)) {
                        disciplinas = data;
                        populateDisciplinaSelect();
                    } else {
                        localStorage.removeItem(cacheKeyDisciplinas);
                    }
                } catch (e) {
                    localStorage.removeItem(cacheKeyDisciplinas);
                }
            }

            const [dashboardData, disciplinasData] = await Promise.all([
                retryFetch('/api/dashboard_data', { credentials: 'include' }),
                retryFetch('/api/disciplinas', { credentials: 'include' })
            ]);

            classes = Array.isArray(dashboardData.turmas) ? dashboardData.turmas : [];
            disciplinas = Array.isArray(disciplinasData) ? disciplinasData : [];

            if (!isRendered || classes.length > 0) {
                renderClasses();
            }
            populateDisciplinaSelect();

            if (overlay && mainContent) {
                overlay.remove();
                mainContent.classList.remove('pointer-events-none');
            }
        } catch (error) {
            showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle', 3000);
            renderClasses();
            if (overlay && mainContent) {
                overlay.remove();
                mainContent.classList.remove('pointer-events-none');
            }
        }
    }

    function populateDisciplinaSelect() {
        const select = document.getElementById('create-disciplina-id');
        select.innerHTML = '<option value="" disabled selected hidden>Escolha uma disciplina...</option>';
        disciplinas.forEach(disciplina => {
            const option = document.createElement('option');
            option.value = disciplina.id;
            option.textContent = disciplina.nome.charAt(0).toUpperCase() + disciplina.nome.slice(1);
            select.appendChild(option);
        });
    }

    function filterClasses(type) {
        const filtered = type ? classes.filter(cls => cls.type === type) : classes;
        renderClasses(filtered);

        document.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
        });
        if (type) {
            document.querySelector(`#filter-${type}`).classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            document.querySelector(`#filter-${type}`).classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
        }
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    function extractClassName(name) {
        const match = name.match(/^[^0-9]+/i);
        return match ? match[0].trim() : name;
    }

    function renderClasses(filteredClasses = classes) {
        const tbody = document.getElementById('class-table-body');
        tbody.innerHTML = '';

        if (filteredClasses.length === 0) {
            const colspan = currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador' ? 8 : 7;
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">Nenhuma turma encontrada.</td></tr>`;
        } else {
            filteredClasses.forEach((cls, index) => {
                const icon = cls.type === 'motora' ? 'fast-forward' : 'brain';
                const iconColor = cls.type === 'motora' ? 'text-purple-600' : 'text-green-600';
                const typeClass = cls.type === 'cognitiva' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600';
                const typeText = cls.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
                const firstName = extractClassName(cls.name);
                const capitalizedName = capitalizeFirstLetter(firstName);
                const typeStyle = cls.type === 'motora' ? 'style="background-color: #f3e8ff"' : '';
                const actionButtons = (currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador')
                    ? `<td class="px-6 py-4">
                           <button class="edit-button" data-index="${index}">
                               <i data-lucide="edit" class="h-4 w-4 mr-1"></i> Editar
                           </button>
                           <button class="delete-button" data-id="${cls.id}">
                               <i data-lucide="trash-2" class="h-4 w-4 mr-1"></i> Excluir
                           </button>
                       </td>`
                    : '';
                tbody.innerHTML += `
                    <tr>
                        <td class="px-6 py-4">
                            <div class="flex items-center">
                                <i data-lucide="${icon}" class="h-10 w-10 ${iconColor} flex items-center justify-center mr-3"></i>
                                <div>
                                    <div class="font-medium">${capitalizedName}</div>
                                    <div class="text-sm text-gray-500">Faixa etária: ${formatGrades(cls.grades)} anos</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">${cls.polo_name}</td>
                        <td class="px-6 py-4">
                            <span class="inline-flex px-2 py-1 rounded-full text-xs font-medium ${typeClass}" ${typeStyle}>
                                ${typeText}
                            </span>
                        </td>
                        <td class="px-6 py-4">${formatGrades(cls.grades)}</td>
                        <td class="px-6 py-4">${formatSchedule(cls.day)}</td>
                        <td class="px-6 py-4">${cls.period}</td>
                        <td class="px-6 py-4">
                            ${cls.enrollmentCount}/${cls.capacity}
                            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${(cls.enrollmentCount / cls.capacity * 100).toFixed(0)}%"></div>
                            </div>
                        </td>
                        ${actionButtons}
                    </tr>
                `;
            });

            document.querySelectorAll('.edit-button').forEach(button => {
                button.addEventListener('click', () => {
                    const index = button.getAttribute('data-index');
                    openEditModal(index);
                });
            });

            document.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', () => {
                    const classId = button.getAttribute('data-id');
                    deleteClass(classId);
                });
            });
        }
        lucide.createIcons();
    }

    function formatSchedule(day) {
        const days = {
            monday: 'Segunda-feira',
            tuesday: 'Terça-feira',
            wednesday: 'Quarta-feira',
            thursday: 'Quinta-feira',
            friday: 'Sexta-feira',
            seg: 'Segunda-feira',
            ter: 'Terça-feira',
            qua: 'Quarta-feira',
            qui: 'Quinta-feira',
            sex: 'Sexta-feira'
        };
        return days[day] || day;
    }

    function formatGrades(grades) {
        if (!grades) {
            return 'Não especificado';
        }

        let gradesString;
        if (Array.isArray(grades)) {
            gradesString = grades.join(',');
        } else if (typeof grades === 'string') {
            gradesString = grades;
        } else {
            return 'Não especificado';
        }

        try {
            return gradesString.split(',').map(g => `${g.trim()}º`).join(' e ');
        } catch (error) {
            return 'Não especificado';
        }
    }

    function openEditModal(index) {
        const cls = classes[index];
        if (!cls) {
            return;
        }

        const modal = document.getElementById('edit-class-modal');
        if (!modal) {
            return;
        }
        modal.style.display = 'block';

        document.getElementById('edit-class-id').value = cls.id || '';
        document.getElementById('edit-name').value = cls.name || '';
        document.getElementById('edit-polo-name').value = cls.polo_name || userPoloName;
        document.getElementById('edit-type').value = cls.type || 'cognitiva';

        const gradesSelect = document.getElementById('edit-grades');
        const gradesValue = JSON.stringify(cls.grades);
        if (gradesSelect.querySelector(`option[value='${gradesValue}']`)) {
            gradesSelect.value = gradesValue;
        } else {
            gradesSelect.value = '["4", "5"]';
        }

        const daySelect = document.getElementById('edit-day');
        if (cls.day && daySelect.querySelector(`option[value="${cls.day}"]`)) {
            daySelect.value = cls.day;
        } else {
            daySelect.value = 'seg';
        }

        const periodSelect = document.getElementById('edit-period');
        if (cls.period && periodSelect.querySelector(`option[value="${cls.period.toLowerCase()}"]`)) {
            periodSelect.value = cls.period.toLowerCase();
        } else {
            periodSelect.value = 'manha';
        }

        document.getElementById('edit-capacity').value = cls.capacity || 0;
    }

    function closeEditModal() {
        const modal = document.getElementById('edit-class-modal');
        if (!modal) {
            return;
        }
        modal.style.display = 'none';
    }

    async function saveClassChanges(event) {
        event.preventDefault();
        const form = document.getElementById('edit-class-form');
        const formData = new FormData(form);
        const classData = Object.fromEntries(formData);
        classData.grades = JSON.parse(classData.grades);

        try {
            const updateResponse = await retryFetch(`/api/turmas/${classData.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(classData),
                credentials: 'include'
            });
            showToast('Dados da turma salvos com sucesso!', 'success', 'check-circle', 3000);

            const unenrollResponse = await retryFetch(`/api/turmas/${classData.id}/unenroll`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            showToast('Alunos desmatriculados com sucesso! É necessário matriculá-los novamente.', 'warning', 'alert-circle', 5000);

            closeEditModal();
            fetchData();
        } catch (error) {
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        }
    }

    async function deleteClass(classId) {
        if (!confirm('Tem certeza que deseja excluir esta turma? Todos os alunos matriculados serão desmatriculados.')) {
            return;
        }

        try {
            const response = await retryFetch(`/api/turmas/${classId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            showToast('Turma excluída com sucesso!', 'success', 'check-circle', 3000);
            fetchData();
        } catch (error) {
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        }
    }

    function openCreateModal() {
        const modal = document.getElementById('create-class-modal');
        if (!modal) {
            return;
        }
        modal.style.display = 'block';

        document.getElementById('create-class-form').reset();
        document.querySelectorAll('.tooltip').forEach(tooltip => {
            tooltip.style.display = 'none';
        });

        updateTypeIcon(disciplinas.length > 0 ? disciplinas[0].tipo : 'cognitiva');
        lucide.createIcons();
    }

    function closeCreateModal() {
        const modal = document.getElementById('create-class-modal');
        if (!modal) {
            return;
        }
        modal.style.display = 'none';
    }

    function updateTypeIcon(type) {
        const typeIcon = document.getElementById('type-icon');
        if (!typeIcon) return;

        typeIcon.removeAttribute('data-lucide');
        typeIcon.className = 'h-5 w-5 mr-2';

        typeIcon.setAttribute('data-lucide', type === 'cognitiva' ? 'brain' : 'fast-forward');
        lucide.createIcons();
    }

    function showTooltip(elementId, message) {
        const tooltip = document.getElementById(`tooltip-${elementId}`);
        if (tooltip) {
            tooltip.textContent = message;
            tooltip.style.display = 'block';
        }
    }

    async function createClass(event) {
        event.preventDefault();

        const form = document.getElementById('create-class-form');
        if (!form) {
            return;
        }

        const formData = new FormData(form);
        const classData = Object.fromEntries(formData);

        let hasError = false;
        const fields = [
            { id: 'name', message: 'Por favor, insira o nome da turma' },
            { id: 'disciplina_id', message: 'Por favor, selecione a disciplina da turma' },
            { id: 'day', message: 'Por favor, selecione o dia da semana' },
            { id: 'period', message: 'Por favor, selecione o período' },
            { id: 'grades', message: 'Por favor, selecione o ano escolar' },
            { id: 'polo_name', message: 'Por favor, selecione o polo' },
            { id: 'capacity', message: 'Por favor, insira a capacidade da turma' }
        ];

        fields.forEach(field => {
            const value = classData[field.id];
            if (!value || value.trim() === '') {
                showTooltip(field.id, field.message);
                hasError = true;
            }
        });

        if (hasError) {
            return;
        }

        try {
            classData.grades = JSON.parse(classData.grades);
        } catch (error) {
            showTooltip('grades', 'Erro ao processar o ano escolar');
            return;
        }

        try {
            const createResponse = await retryFetch('/api/turmas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(classData),
                credentials: 'include'
            });
            showToast('Turma criada com sucesso!', 'success', 'check-circle', 3000);
            closeCreateModal();
            fetchData();
        } catch (error) {
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        }
    }

    function showToast(message, type, icon, duration = 3000) {
        const toastContainer = document.getElementById('custom-toast-container');
        if (!toastContainer) {
            return;
        }

        const toastDiv = document.createElement('div');
        toastDiv.className = `custom-toast custom-toast-${type}`;
        toastDiv.innerHTML = `
            <i data-lucide="${icon}" class="custom-toast-icon h-3 w-3"></i>
            <span class="custom-toast-message">${message}</span>
            <button class="custom-toast-close">×</button>
        `;

        toastContainer.appendChild(toastDiv);

        lucide.createIcons();

        const timeout = setTimeout(() => {
            toastDiv.remove();
        }, duration);

        const closeButton = toastDiv.querySelector('.custom-toast-close');
        closeButton.addEventListener('click', () => {
            clearTimeout(timeout);
            toastDiv.remove();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const editModal = document.getElementById('edit-class-modal');
        if (editModal) {
            editModal.addEventListener('click', (event) => {
                if (event.target === editModal) {
                    closeEditModal();
                }
            });
        }

        const createModal = document.getElementById('create-class-modal');
        if (createModal) {
            createModal.addEventListener('click', (event) => {
                if (event.target === createModal) {
                    closeCreateModal();
                }
            });
        }

        const cancelEditButton = document.getElementById('cancel-edit-class');
        if (cancelEditButton) {
            cancelEditButton.addEventListener('click', closeEditModal);
        }

        const cancelCreateButton = document.getElementById('cancel-create-class');
        if (cancelCreateButton) {
            cancelCreateButton.addEventListener('click', closeCreateModal);
        }

        const createClassButton = document.getElementById('create-class-button');
        if (createClassButton) {
            createClassButton.addEventListener('click', openCreateModal);
        }

        const createClassForm = document.getElementById('create-class-form');
        if (createClassForm) {
            createClassForm.addEventListener('submit', createClass);
        }

        const disciplinaSelect = document.getElementById('create-disciplina-id');
        if (disciplinaSelect) {
            disciplinaSelect.addEventListener('change', (event) => {
                const selectedDisciplinaId = event.target.value;
                const selectedDisciplina = disciplinas.find(d => d.id === selectedDisciplinaId);
                updateTypeIcon(selectedDisciplina ? selectedDisciplina.tipo : 'cognitiva');
            });
        }

        fetchData();

        document.getElementById('filter-cognitiva').addEventListener('click', () => filterClasses('cognitiva'));
        document.getElementById('filter-motora').addEventListener('click', () => filterClasses('motora'));
        document.getElementById('edit-class-form').addEventListener('submit', saveClassChanges);
    });
})();