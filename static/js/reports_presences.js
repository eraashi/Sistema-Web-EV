let presences = [];
let classes = [];
let occurrences = [];

// Estado global para paginação
let currentPage = 1;
const itemsPerPage = 20;

// Função de retentativa para requisições
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
    const overlay = document.getElementById('loading-overlay');
    const mainContent = document.querySelector('.space-y-8');

    if (overlay && mainContent) {
        overlay.classList.remove('hidden');
        mainContent.classList.add('pointer-events-none');
    }

    try {
        presences = [];
        classes = [];
        occurrences = [];

        let isRendered = false;

        const cacheKeyDashboard = 'cache_/api/dashboard_data';
        const cachedDashboard = localStorage.getItem(cacheKeyDashboard);
        if (cachedDashboard) {
            try {
                const { data, timestamp } = JSON.parse(cachedDashboard);
                if (Date.now() - timestamp < 10000 && data && Array.isArray(data.turmas) && data.turmas.length > 0) {
                    classes = data.turmas;
                    isRendered = true;
                    renderPresences(presences, classes);
                } else {
                    localStorage.removeItem(cacheKeyDashboard);
                }
            } catch (e) {
                localStorage.removeItem(cacheKeyDashboard);
            }
        }

        const [dashboardData, presencesData, occurrencesData] = await Promise.all([
            retryFetch('/api/dashboard_data', { credentials: 'include' }),
            retryFetch('/api/presencas', { credentials: 'include' }),
            retryFetch('/api/ocorrencias', { credentials: 'include' })
        ]);

        classes = Array.isArray(dashboardData.turmas) ? dashboardData.turmas : [];
        presences = Array.isArray(presencesData) ? presencesData : [];
        occurrences = Array.isArray(occurrencesData) ? occurrencesData : [];

        if (!isRendered || classes.length > 0 || presences.length > 0) {
            renderPresences(presences, classes);
        }

        if (overlay && mainContent) {
            overlay.classList.add('hidden');
            mainContent.classList.remove('pointer-events-none');
        }
    } catch (error) {
        showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle');
        renderPresences(presences, classes);
        if (overlay && mainContent) {
            overlay.classList.add('hidden');
            mainContent.classList.remove('pointer-events-none');
        }
    }
}

function showToast(message, type, icon) {
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
    }, 3000);

    const closeButton = toastDiv.querySelector('.custom-toast-close');
    closeButton.addEventListener('click', () => {
        clearTimeout(timeout);
        toastDiv.remove();
    });
}

function groupPresencesByTurmaDayShift(presences) {
    const grouped = {};

    presences.forEach(presence => {
        const key = `${presence.turma_id}_${presence.data_escaneamento}_${presence.turno_escola_viva}`;
        if (!grouped[key]) {
            grouped[key] = {
                turma_id: presence.turma_id,
                turma_nome: presence.turma_nome,
                etapas: new Set(),
                turno: presence.turno_escola_viva,
                dia: presence.data_escaneamento,
                hora: presence.hora_escaneamento,
                polo_nome: presence.polo_nome,
                alunos: []
            };
        }
        grouped[key].etapas.add(presence.etapa);
        grouped[key].alunos.push(presence);
    });

    Object.values(grouped).forEach(group => {
        group.etapas = Array.from(group.etapas);
    });

    return Object.values(grouped);
}

function groupOccurrencesByTurmaDate(occurrences) {
    const grouped = {};

    occurrences.forEach(occurrence => {
        const key = `${occurrence.turma_id}_${occurrence.data_escaneamento}`;
        if (!grouped[key]) {
            grouped[key] = {
                turma_id: occurrence.turma_id,
                turma_nome: occurrence.turma_nome,
                faixa_etaria: occurrence.faixa_etaria,
                turno: occurrence.turno,
                data: occurrence.data_escaneamento,
                polo_nome: occurrence.polo_nome,
                ocorrencias: []
            };
        }
        grouped[key].ocorrencias.push(occurrence.ocorrencia);
    });

    return Object.values(grouped);
}

function formatTurmaName(name) {
    const match = name.match(/^[^0-9]+/i);
    const firstName = match ? match[0].trim() : name;
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

function formatDateToBrazilian(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

function filterPresences(presences, classes) {
    const dateFilter = document.getElementById('filter-date').value;
    const timeFilter = document.getElementById('filter-time').value;
    const shiftFilter = document.getElementById('filter-shift').value;
    const disciplineFilter = document.getElementById('filter-discipline').value;
    const gradesFilter = document.getElementById('filter-grades').value;

    const presencesWithDiscipline = presences.map(presence => {
        const turma = classes.find(cls => cls.id === presence.turma_id);
        return {
            ...presence,
            discipline: turma ? turma.type : ''
        };
    });

    return groupPresencesByTurmaDayShift(presencesWithDiscipline).filter(group => {
        const formattedDate = group.dia;
        const matchesDate = !dateFilter || formattedDate === dateFilter;

        let matchesTime = true;
        if (timeFilter) {
            const selectedHour = parseInt(timeFilter.replace('h', ''), 10);
            if (group.hora) {
                const hourMatch = group.hora.match(/^(\d{2}):(\d{2}):(\d{2})$/);
                if (hourMatch) {
                    const hour = parseInt(hourMatch[1], 10);
                    matchesTime = hour === selectedHour;
                } else {
                    matchesTime = false;
                }
            } else {
                matchesTime = false;
            }
        }

        const matchesShift = !shiftFilter || group.turno.toLowerCase() === shiftFilter.toLowerCase();

        const matchesDiscipline = !disciplineFilter || group.alunos.some(aluno => {
            const turma = classes.find(cls => cls.id === aluno.turma_id);
            return turma && turma.type.toLowerCase() === disciplineFilter.toLowerCase();
        });

        const matchesGrades = !gradesFilter || group.etapas.includes(gradesFilter);

        return matchesDate && matchesTime && matchesShift && matchesDiscipline && matchesGrades;
    });
}

function renderPresences(presences, classes) {
    const presencesSection = document.getElementById('presences-section');
    const paginationSection = document.getElementById('pagination-section') || document.createElement('div');
    paginationSection.id = 'pagination-section';
    paginationSection.className = 'flex justify-center mt-6 space-x-2';

    presencesSection.innerHTML = '';
    paginationSection.innerHTML = '';

    const filteredPresences = filterPresences(presences, classes);
    const totalItems = filteredPresences.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (currentPage > totalPages) {
        currentPage = totalPages || 1;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentPresences = filteredPresences.slice(startIndex, endIndex);

    currentPresences.forEach(group => {
        const formattedTurmaName = formatTurmaName(group.turma_nome);
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow-md border-2 border-blue-300 transition-all duration-300 hover:bg-blue-50 hover:shadow-xl';
        card.innerHTML = `
            <div class="mb-2">
                <h3 class="text-lg font-semibold">${formattedTurmaName}</h3>
                <p class="text-sm text-gray-600">Etapas: ${group.etapas.join(' e ')}</p>
                <p class="text-sm text-gray-600">Turno: ${group.turno}</p>
                <p class="text-sm text-gray-600">Polo: ${group.polo_nome}</p>
                <p class="text-sm text-gray-600">Dia: ${formatDateToBrazilian(group.dia)}</p>
                <p class="text-sm text-gray-600">Hora: ${group.hora}</p>
            </div>
            <hr class="border-t border-gray-200 my-4">
            <div class="flex justify-end mt-4 space-x-2">
                <button class="view-students-btn bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">Visualizar</button>
                <div class="dropdown-container">
                    <button class="print-btn">Imprimir</button>
                    <div class="dropdown-menu">
                        <a href="#" class="print-excel">Excel</a>
                        <a href="#" class="print-pdf">PDF</a>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.view-students-btn').addEventListener('click', () => {
            openViewStudentsModal(group);
        });

        const printBtn = card.querySelector('.print-btn');
        const dropdownMenu = card.querySelector('.dropdown-menu');
        printBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!printBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });

        card.querySelector('.print-excel').addEventListener('click', (e) => {
            e.preventDefault();
            generateExcel(group);
            dropdownMenu.classList.remove('show');
        });

        card.querySelector('.print-pdf').addEventListener('click', (e) => {
            e.preventDefault();
            generatePDF(group);
            dropdownMenu.classList.remove('show');
        });

        presencesSection.appendChild(card);
    });

    if (totalItems > 0) {
        const prevButton = document.createElement('button');
        prevButton.className = `px-4 py-2 rounded-md ${currentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`;
        prevButton.textContent = 'Anterior';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPresences(presences, classes);
            }
        });

        const pageNumbers = document.createElement('div');
        pageNumbers.className = 'flex space-x-1';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            const firstPage = document.createElement('button');
            firstPage.className = 'px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300';
            firstPage.textContent = '1';
            firstPage.addEventListener('click', () => {
                currentPage = 1;
                renderPresences(presences, classes);
            });
            pageNumbers.appendChild(firstPage);

            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.className = 'px-4 py-2 text-gray-700';
                dots.textContent = '...';
                pageNumbers.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `px-4 py-2 rounded-md ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                currentPage = i;
                renderPresences(presences, classes);
            });
            pageNumbers.appendChild(pageButton);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.className = 'px-4 py-2 text-gray-700';
                dots.textContent = '...';
                pageNumbers.appendChild(dots);
            }

            const lastPage = document.createElement('button');
            lastPage.className = 'px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300';
            lastPage.textContent = totalPages;
            lastPage.addEventListener('click', () => {
                currentPage = totalPages;
                renderPresences(presences, classes);
            });
            pageNumbers.appendChild(lastPage);
        }

        const nextButton = document.createElement('button');
        nextButton.className = `px-4 py-2 rounded-md ${currentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`;
        nextButton.textContent = 'Próximo';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPresences(presences, classes);
            }
        });

        paginationSection.appendChild(prevButton);
        paginationSection.appendChild(pageNumbers);
        paginationSection.appendChild(nextButton);
        presencesSection.parentElement.appendChild(paginationSection);
    }
}

function openViewStudentsModal(group) {
    const modal = document.getElementById('view-students-modal');
    const modalDate = document.getElementById('modal-date');
    const modalDetails = document.getElementById('modal-details');
    const studentsList = document.getElementById('students-list');
    const occurrencesList = document.getElementById('occurrences-list');
    const closeModalBtn = document.getElementById('close-modal');

    const formattedTurmaName = formatTurmaName(group.turma_nome);
    const formattedDate = formatDateToBrazilian(group.dia);
    modalDate.textContent = `Presença do dia: ${formattedDate}`;

    modalDetails.innerHTML = `
        <h3 class="text-lg font-semibold mb-2">${formattedTurmaName}</h3>
        Etapas: ${group.etapas.join(' e ')} | 
        Turno: ${group.turno} | 
        Polo: ${group.polo_nome} | 
        Dia: ${formatDateToBrazilian(group.dia)} | 
        Hora: ${group.hora}
    `;

    const groupedStudents = {};
    group.alunos.forEach(student => {
        const studentId = student.id_aluno;
        if (!groupedStudents[studentId]) {
            groupedStudents[studentId] = {
                nome_aluno: student.nome_aluno,
                unidade: student.unidade,
                presencas: []
            };
        }
        groupedStudents[studentId].presencas.push(student.presenca);
    });

    studentsList.innerHTML = '';
    Object.values(groupedStudents).forEach(student => {
        const studentItem = document.createElement('div');
        studentItem.className = 'border-b border-gray-200 py-2 flex items-center';

        let emoji = '';
        const hasCheckin = student.presencas.includes('checkin');
        const hasCheckout = student.presencas.includes('checkout');
        const isAbsent = student.presencas.includes('ausente');

        if (hasCheckin || hasCheckout) {
            emoji = '✅';
        } else if (isAbsent) {
            emoji = '❌';
        }

        studentItem.innerHTML = `
            <div class="flex w-full">
                <span style="width: 400px;">${student.nome_aluno}</span>
                <span style="width: 300px;">${student.unidade}</span>
                <span style="width: 50px; text-align: right;">${emoji}</span>
            </div>
        `;
        studentsList.appendChild(studentItem);
    });

    occurrencesList.innerHTML = '';
    const groupedOccurrences = groupOccurrencesByTurmaDate(occurrences);
    const matchingOccurrences = groupedOccurrences.find(oc => 
        oc.turma_id === group.turma_id && oc.data === group.dia
    );

    if (matchingOccurrences && matchingOccurrences.ocorrencias.length > 0) {
        matchingOccurrences.ocorrencias.forEach(ocorrencia => {
            const occurrenceItem = document.createElement('p');
            occurrenceItem.textContent = ocorrencia;
            occurrencesList.appendChild(occurrenceItem);
        });
    } else {
        const placeholder = document.createElement('p');
        placeholder.textContent = 'Sem registros de ocorrências';
        occurrencesList.appendChild(placeholder);
    }

    modal.classList.add('active');

    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    }, { once: true });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    }, { once: true });
}

function generateExcel(group) {
    const formattedTurmaName = formatTurmaName(group.turma_nome);
    const formattedDate = formatDateToBrazilian(group.dia);

    const data = [
        ["Presença do dia:", formattedDate],
        ["Turma:", formattedTurmaName],
        ["Etapas:", group.etapas.join(' e '), "Turno:", group.turno, "Polo:", group.polo_nome, "Dia:", formatDateToBrazilian(group.dia), "Hora:", group.hora],
        [],
        ["Nome", "Unidade", "Presença"]
    ];

    const groupedStudents = {};
    group.alunos.forEach(student => {
        const studentId = student.id_aluno;
        if (!groupedStudents[studentId]) {
            groupedStudents[studentId] = {
                nome_aluno: student.nome_aluno,
                unidade: student.unidade,
                presencas: []
            };
        }
        groupedStudents[studentId].presencas.push(student.presenca);
    });

    Object.values(groupedStudents).forEach(student => {
        let status = '';
        const hasCheckin = student.presencas.includes('checkin');
        const hasCheckout = student.presencas.includes('checkout');
        const isAbsent = student.presencas.includes('ausente');

        if (hasCheckin || hasCheckout) {
            status = 'Presente';
        } else if (isAbsent) {
            status = 'Ausente';
        }

        data.push([student.nome_aluno, student.unidade, status]);
    });

    const groupedOccurrences = groupOccurrencesByTurmaDate(occurrences);
    const matchingOccurrences = groupedOccurrences.find(oc => 
        oc.turma_id === group.turma_id && oc.data === group.dia
    );

    data.push([], ["Ocorrências:"]);
    if (matchingOccurrences && matchingOccurrences.ocorrencias.length > 0) {
        matchingOccurrences.ocorrencias.forEach(ocorrencia => {
            data.push([ocorrencia]);
        });
    } else {
        data.push(["Sem registros de ocorrências"]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presenças");
    XLSX.writeFile(wb, `Presencas_${formattedTurmaName}_${formattedDate}.xlsx`);
}

function generatePDF(group) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const formattedTurmaName = formatTurmaName(group.turma_nome);
    const formattedDate = formatDateToBrazilian(group.dia);

    doc.setFontSize(16);
    doc.text(`Presença do dia: ${formattedDate}`, 14, 20);
    doc.setFontSize(14);
    doc.text(`Turma: ${formattedTurmaName}`, 14, 30);
    doc.setFontSize(12);
    doc.text(`Etapas: ${group.etapas.join(' e ')} | Turno: ${group.turno} | Polo: ${group.polo_nome} | Dia: ${formatDateToBrazilian(group.dia)} | Hora: ${group.hora}`, 14, 40);

    const tableData = [];
    const groupedStudents = {};
    group.alunos.forEach(student => {
        const studentId = student.id_aluno;
        if (!groupedStudents[studentId]) {
            groupedStudents[studentId] = {
                nome_aluno: student.nome_aluno,
                unidade: student.unidade,
                presencas: []
            };
        }
        groupedStudents[studentId].presencas.push(student.presenca);
    });

    Object.values(groupedStudents).forEach(student => {
        let status = '';
        const hasCheckin = student.presencas.includes('checkin');
        const hasCheckout = student.presencas.includes('checkout');
        const isAbsent = student.presencas.includes('ausente');

        if (hasCheckin || hasCheckout) {
            status = 'Presente';
        } else if (isAbsent) {
            status = 'Ausente';
        }

        tableData.push([student.nome_aluno, student.unidade, status]);
    });

    doc.autoTable({
        startY: 50,
        head: [['Nome', 'Unidade', 'Presença']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [147, 197, 253] },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 80 },
            2: { cellWidth: 20 }
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
                const cellText = data.cell.text[0];
                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                const cellHeight = data.cell.height;

                doc.setFillColor(255, 255, 255);
                doc.rect(cellX, cellY, cellWidth, cellHeight, 'F');

                if (cellText === 'Presente') {
                    doc.setTextColor(0, 100, 0);
                    doc.setFont("helvetica", "bold");
                } else if (cellText === 'Ausente') {
                    doc.setTextColor(204, 85, 0);
                    doc.setFont("helvetica", "bold");
                }

                const textWidth = doc.getTextWidth(cellText);
                const textX = cellX + (cellWidth - textWidth) / 2;
                const textY = cellY + (cellHeight / 2) + 1;
                doc.text(cellText, textX, textY);

                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "normal");
            }
        }
    });

    const groupedOccurrences = groupOccurrencesByTurmaDate(occurrences);
    const matchingOccurrences = groupedOccurrences.find(oc => 
        oc.turma_id === group.turma_id && oc.data === group.dia
    );

    let finalY = doc.lastAutoTable.finalY || 50;
    finalY += 10;

    doc.setFontSize(14);
    doc.text("Ocorrências:", 14, finalY);
    finalY += 6;

    doc.setFontSize(12);
    if (matchingOccurrences && matchingOccurrences.ocorrencias.length > 0) {
        matchingOccurrences.ocorrencias.forEach((ocorrencia, index) => {
            doc.text(`${index + 1}. ${ocorrencia}`, 14, finalY);
            finalY += 6;
        });
    } else {
        doc.text("Sem registros de ocorrências", 14, finalY);
    }

    doc.save(`Presencas_${formattedTurmaName}_${formattedDate}.pdf`);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    const filters = ['filter-date', 'filter-time', 'filter-shift', 'filter-discipline', 'filter-grades'];
    filters.forEach(filterId => {
        document.getElementById(filterId).addEventListener('change', () => {
            currentPage = 1;
            renderPresences(presences, classes);
        });
    });
});