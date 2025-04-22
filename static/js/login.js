function login() {
    const cpf = document.getElementById('cpf').value;
    const password = document.getElementById('password').value;
  
    fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, password })
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || 'Erro ao fazer login');
          });
        }
        return response.json();
      })
      .then(data => {
        window.location.href = '/';
      })
      .catch(error => {
        console.error('Erro no login:', error.message);
        alert('Erro: ' + error.message);
      });
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/alunos')
      .then(response => {
        if (response.ok) {
          window.location.href = '/';
        }
      });
  });