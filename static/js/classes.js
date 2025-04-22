(function () {
    let classes = [];

    async function fetchClasses() {
        try {
            const response = await fetch('/api/turmas', { credentials: 'include' });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao carregar turmas: ${errorText}`);
            }
            classes = await response.json();
            console.log('Turmas carregadas:', classes);
            console.log('Tipos de turmas disponíveis:', [...new Set(classes.map(cls => cls.type))]);
            const motorClasses = classes.filter(cls => cls.type === 'motora');
            console.log('Número de turmas motoras:', motorClasses.length);
            console.log('Turmas motoras:', motorClasses);
            renderClasses();
        } catch (error) {
            console.error('Erro em fetchClasses:', error.message);
            alert('Erro: ' + error.message);
            window.location.href = '/login';
        }
    }

    function filterClasses(type) {
        console.log(`Filtrando turmas do tipo: ${type}`);
        const filtered = type ? classes.filter(cls => {
            const matchesType = cls.type === type;
            console.log(`Turma ${cls.name}: type=${cls.type}, matches=${matchesType}`);
            return matchesType;
        }) : classes;
        console.log('Turmas filtradas:', filtered);
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
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Nenhuma turma encontrada.</td></tr>';
        } else {
            filteredClasses.forEach(cls => {
                const initials = cls.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                const typeClass = cls.type === 'cognitiva' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600';
                const typeText = cls.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
                const firstName = extractClassName(cls.name);
                const capitalizedName = capitalizeFirstLetter(firstName);
                tbody.innerHTML += `
                    <tr>
                        <td class="px-6 py-4">
                            <div class="flex items-center">
                                <div class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3">${initials}</div>
                                <div>
                                    <div class="font-medium">${capitalizedName}</div>
                                    <div class="text-sm text-gray-500">Faixa etária: ${formatGrades(cls.grades)} anos</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">${cls.polo_name}</td>
                        <td class="px-6 py-4">
                            <span class="inline-flex px-2 py-1 rounded-full text-xs font-medium ${typeClass}">
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
                    </tr>
                `;
            });
        }
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
            console.warn('grades está vazio ou indefinido:', grades);
            return 'Não especificado';
        }

        let gradesString;
        if (Array.isArray(grades)) {
            gradesString = grades.join(',');
        } else if (typeof grades === 'string') {
            gradesString = grades;
        } else {
            console.warn('grades não é uma string nem um array:', grades);
            return 'Não especificado';
        }

        try {
            return gradesString.split(',').map(g => `${g.trim()}º`).join(' e ');
        } catch (error) {
            console.error('Erro ao formatar grades:', error, 'grades:', grades);
            return 'Não especificado';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        fetchClasses();

        // Adicionar event listeners para os botões
        document.getElementById('filter-cognitiva').addEventListener('click', () => filterClasses('cognitiva'));
        document.getElementById('filter-motora').addEventListener('click', () => filterClasses('motora'));
    });
})();