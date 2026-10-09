// ============================================================
// PARTE 0: FUNÇÕES COMPARTILHADAS
// Usadas por várias páginas (cadastro, login, garimpo), por isso
// ficam fora dos blocos "if" de cada página
// ============================================================

// Nome da "gaveta" do localStorage onde ficam todos os usuários
const CHAVE_USUARIOS = "usuarios";

// Nome da "gaveta" TEMPORÁRIA (sessionStorage) usada para levar o e-mail e a
// senha do cadastro até a tela de login, que os lê e apaga na hora
const CHAVE_PREENCHER_LOGIN = "preencherLogin";

// Hash SHA-256 de um texto (devolve o resultado em hexadecimal)
async function gerarHash(texto) {
    // crypto.subtle só existe em endereços seguros (file://, localhost ou https)
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error(
            "A criptografia não está disponível neste endereço. " +
            "Abra a página pelo arquivo local, pelo Live Server (localhost) ou por https."
        );
    }
    const dados = new TextEncoder().encode(texto);
    const buffer = await crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// localStorage + JSON
// Lê a lista de usuários salva no navegador (ou devolve lista vazia)
function lerUsuarios() {
    try {
        const texto = localStorage.getItem(CHAVE_USUARIOS); // texto JSON ou null
        const lista = texto ? JSON.parse(texto) : [];       // texto -> array de objetos
        return Array.isArray(lista) ? lista : [];
    } catch (erro) {
        // JSON quebrado (alguém editou à mão, por exemplo): recomeça do zero
        console.error("Não foi possível ler os usuários salvos:", erro);
        return [];
    }
}

// Grava a lista inteira de volta no navegador
function salvarUsuarios(lista) {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(lista)); // array -> texto JSON
}

// Baixa um arquivo .txt com o conteúdo recebido (Blob)
// Usada no cadastro e no garimpo
function baixarTxt(conteudo, nomeArquivo) {
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;

    document.body.appendChild(link);   // alguns navegadores exigem o link na página
    link.click();
    document.body.removeChild(link);

    // espera 1s antes de liberar a URL, senão o download pode ser cancelado
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// PARTE 1: FORMULÁRIO DE CADASTRO
// Só roda se a página tiver o formulário (senão dava erro e
// travava o resto do script, inclusive o menu lateral)
// ============================================================

const form = document.getElementById("form-cadastro");
const campoCPF = document.getElementById("cpf");

if (form && campoCPF) {

    // 1) CPF: apaga na hora qualquer caractere que não seja número
    campoCPF.addEventListener("input", () => {
        campoCPF.value = campoCPF.value.replace(/\D/g, "");
    });

    // 2) Gera um "sal" aleatório (texto extra misturado à senha antes do hash)
    function gerarSal() {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    // 3) Envio do formulário
    form.addEventListener("submit", async (evento) => {
        evento.preventDefault(); // impede a página de recarregar

        // O try/catch evita que um erro "silencioso" trave tudo sem avisar
        try {
            const nome = document.getElementById("nome").value.trim();
            const email = document.getElementById("email").value.trim().toLowerCase();
            const cpf = campoCPF.value;
            const endereco = document.getElementById("endereco").value.trim();
            const senha = document.getElementById("senha").value;
            const generoLiterario = document.getElementById("generolit").value.trim();

            // E-mail: precisa ter algo antes do @ e terminar exatamente em @gmail.com
            // (o e-mail já foi convertido para minúsculas lá em cima)
            const emailValido = /^[^\s@]+@gmail\.com$/.test(email);
            if (!emailValido) {
                alert("Digite um e-mail do Gmail, terminando em @gmail.com (exemplo: nome@gmail.com).");
                return;
            }

            // CPF: só números, exatamente 11
            if (!/^\d{11}$/.test(cpf)) {
                alert("O CPF deve ter exatamente 11 números.");
                return;
            }

            // Não permite cadastrar o mesmo e-mail ou CPF duas vezes
            const usuarios = lerUsuarios();
            const jaExiste = usuarios.some(u => u.email === email || u.cpf === cpf);
            if (jaExiste) {
                alert("Já existe um cadastro com esse e-mail ou CPF.");
                return;
            }

            // Senha: hash com sal (a senha em si nunca é guardada de forma permanente)
            const sal = gerarSal();
            const senhaHash = await gerarHash(sal + senha);

            // Objeto com os dados do usuário (é isso que o JSON vai transformar em texto)
            const usuario = {
                nome: nome,
                email: email,
                cpf: cpf,
                endereco: endereco,
                generoLiterario: generoLiterario,
                sal: sal,
                senhaHash: senhaHash,
                dataCadastro: new Date().toISOString()
            };

            // Salva no localStorage
            try {
                usuarios.push(usuario);
                salvarUsuarios(usuarios);
                console.log("Cadastro salvo no localStorage. Total de usuários:", usuarios.length);
            } catch (erro) {
                console.error(erro);
                alert("Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).");
                return;
            }

            // Baixa o .txt
            const conteudo =
`Nome: ${nome}
E-mail: ${email}
CPF: ${cpf}
Endereço: ${endereco}
Preferência de gênero literário: ${generoLiterario}
Sal: ${sal}
Senha (hash SHA-256): ${senhaHash}
Data do cadastro: ${new Date().toLocaleString("pt-BR")}
`;
            baixarTxt(conteudo, "cadastro.txt");

            alert("Cadastro realizado com sucesso! Você será levado para o login.");

            // Guarda E-MAIL e SENHA só por um instante, para a tela de login preencher
            // os campos. O sessionStorage some quando a aba fecha, e o login apaga
            // esses dados assim que os lê.
            sessionStorage.setItem(CHAVE_PREENCHER_LOGIN, JSON.stringify({
                email: email,
                senha: senha
            }));

            form.reset(); // limpa os campos

            // Desativa o botão para não enviar duas vezes durante a espera
            const botaoCadastrar = document.getElementById("botaocadastrar");
            if (botaoCadastrar) botaoCadastrar.disabled = true;

            // Espera 1,5s para o download do .txt começar e então vai para o login
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1500);

        } catch (erro) {
            console.error("Erro no cadastro:", erro);
            alert("Ocorreu um erro ao cadastrar: " + erro.message);
        }
    });
}

// ============================================================
// PARTE 2: FORMULÁRIO DE LOGIN
// Só roda se a página tiver o formulário de login
// ============================================================

const formLogin = document.getElementById("form-login");

// Quantas tentativas erradas o usuário pode fazer
const MAX_TENTATIVAS = 3;

// Nome da "gaveta" do sessionStorage onde fica a contagem de erros.
// Usamos sessionStorage (e não uma variável comum) para que apertar F5
// NÃO zere a contagem.
const CHAVE_TENTATIVAS = "tentativasLogin";

if (formLogin) {

    // 0) Preenchimento automático vindo do cadastro (se o usuário acabou de se cadastrar)
    const dadosRecentes = sessionStorage.getItem(CHAVE_PREENCHER_LOGIN);
    if (dadosRecentes) {
        try {
            const dados = JSON.parse(dadosRecentes); // texto -> objeto
            document.getElementById("email").value = dados.email || "";
            document.getElementById("senha").value = dados.senha || "";
        } catch (erro) {
            console.error("Não foi possível preencher o login:", erro);
        }
        // Apaga NA HORA, para a senha não ficar guardada além do necessário
        sessionStorage.removeItem(CHAVE_PREENCHER_LOGIN);
    }

    // Lê quantas tentativas erradas já aconteceram (0 se nunca errou)
    function lerTentativas() {
        return Number(sessionStorage.getItem(CHAVE_TENTATIVAS)) || 0;
    }

    // Guarda o novo número de tentativas erradas
    function salvarTentativas(numero) {
        sessionStorage.setItem(CHAVE_TENTATIVAS, String(numero));
    }

    // Zera a contagem
    function zerarTentativas() {
        sessionStorage.removeItem(CHAVE_TENTATIVAS);
    }

    // Registra um erro e decide: avisa quantas tentativas restam
    // ou, se chegou no limite, volta para a tela inicial
    function registrarErro() {
        const tentativas = lerTentativas() + 1;
        salvarTentativas(tentativas);

        if (tentativas >= MAX_TENTATIVAS) {
            zerarTentativas(); // quando voltar ao login, começa do zero
            alert("Você errou " + MAX_TENTATIVAS + " vezes. Voltando para a tela inicial.");
            window.location.href = "index.html";
        } else {
            const restantes = MAX_TENTATIVAS - tentativas;
            alert(
                "E-mail ou senha incorretos. " +
                "Tentativas restantes: " + restantes + "."
            );
            document.getElementById("senha").value = ""; // limpa só a senha
        }
    }

    formLogin.addEventListener("submit", async (evento) => {
        evento.preventDefault(); // impede a página de recarregar

        try {
            const email = document.getElementById("email").value.trim().toLowerCase();
            const senha = document.getElementById("senha").value;

            // 1) Procura o usuário pelo e-mail na lista salva no navegador
            const usuarios = lerUsuarios();
            const usuario = usuarios.find(u => u.email === email);

            // E-mail não cadastrado: conta como tentativa errada.
            // A mensagem é igual à da senha errada de propósito, para não
            // revelar quais e-mails existem no site.
            if (!usuario) {
                registrarErro();
                return;
            }

            // 2) Refaz o hash com o MESMO sal que foi usado no cadastro
            const hashDigitado = await gerarHash(usuario.sal + senha);

            // 3) Compara com o hash que foi guardado no cadastro
            if (hashDigitado !== usuario.senhaHash) {
                registrarErro();
                return;
            }

            // 4) Senha correta: zera os erros, guarda quem entrou e vai para o site
            zerarTentativas();
            sessionStorage.setItem("usuarioLogado", JSON.stringify({
                nome: usuario.nome,
                email: usuario.email
            }));
            window.location.href = "kosho.html";

        } catch (erro) {
            console.error("Erro no login:", erro);
            alert("Ocorreu um erro ao entrar: " + erro.message);
        }
    });
}

// ============================================================
// PARTE 3: MENUS LATERAIS (Sobre e Contato)
// ============================================================

// Seleciona os elementos do HTML
const btnSobre = document.getElementById('botaosobre');
const menuVerticalSobre = document.getElementById('menu-vertical-sobre');
const btnContato = document.getElementById('botaocontato');
const menuVerticalContato = document.getElementById('menu-vertical-contato');

// Links de dentro dos menus laterais
const itemEmpresa = document.getElementById('itemempresa');
const itemClientes = document.getElementById('itemclientes');
const itemTelefones = document.getElementById('itemtelefones');
const itemEmail = document.getElementById('itememail');

// Parágrafos (subsubmenus) que cada link abre
const subEmpresa = document.getElementById('sub-empresa');
const subClientes = document.getElementById('sub-clientes');
const subTelefones = document.getElementById('sub-telefones');
const subEmail = document.getElementById('sub-email');

// Função geral para abrir/fechar QUALQUER menu vertical
function abreMenu(event, menu) {
    event.preventDefault(); // evita que o link "#" suba a página para o topo
    menu.classList.toggle('active'); // liga/desliga a classe 'active'
}

// Fecha os dois parágrafos de um menu (se existirem nesta página)
function fechaSubs(sub1, sub2) {
    if (sub1) sub1.classList.remove('aberto');
    if (sub2) sub2.classList.remove('aberto');
}

// Abre o parágrafo clicado e fecha o outro do mesmo menu
function abreSub(event, painel, outroPainel) {
    event.preventDefault(); // evita que o link "#" suba a página para o topo
    outroPainel.classList.remove('aberto'); // só um parágrafo aberto por vez
    painel.classList.toggle('aberto');      // liga/desliga a classe 'aberto'
}

// Fecha o menu se o clique foi fora dele e fora do botão que o abre
function fechaMenu(event, menu, btn) {
    if (!menu || !btn) return; // se o elemento não existe na página, ignora

    if (!menu.contains(event.target) && event.target !== btn) {
        menu.classList.remove('active');
    }
}

// Clique nos botões do menu (só se existirem nesta página)
if (btnSobre && menuVerticalSobre) {
    btnSobre.addEventListener('click', function (event) {
        abreMenu(event, menuVerticalSobre);
        fechaSubs(subEmpresa, subClientes); // começa sempre com os parágrafos fechados
    });
}

if (btnContato && menuVerticalContato) {
    btnContato.addEventListener('click', function (event) {
        abreMenu(event, menuVerticalContato);
        fechaSubs(subTelefones, subEmail);
    });
}

// Clique nos links de dentro do menu "Sobre"
if (itemEmpresa && subEmpresa && subClientes) {
    itemEmpresa.addEventListener('click', function (event) {
        abreSub(event, subEmpresa, subClientes);
    });
}

if (itemClientes && subClientes && subEmpresa) {
    itemClientes.addEventListener('click', function (event) {
        abreSub(event, subClientes, subEmpresa);
    });
}

// Clique nos links de dentro do menu "Contato"
if (itemTelefones && subTelefones && subEmail) {
    itemTelefones.addEventListener('click', function (event) {
        abreSub(event, subTelefones, subEmail);
    });
}

if (itemEmail && subEmail && subTelefones) {
    itemEmail.addEventListener('click', function (event) {
        abreSub(event, subEmail, subTelefones);
    });
}

// Fecha o menu se o usuário clicar fora dele
document.addEventListener('click', function (event) {
    fechaMenu(event, menuVerticalSobre, btnSobre);
    fechaMenu(event, menuVerticalContato, btnContato);
});

// ============================================================
// PARTE 4: DATA NO RODAPÉ
// ============================================================

const campoData = document.getElementById("data-atual");
if (campoData) {
    const hoje = new Date();
    campoData.textContent = hoje.toLocaleDateString("pt-BR");
    campoData.dateTime = hoje.toISOString().slice(0, 10);
}

// ============================================================
// PARTE 5: GARIMPAR (compra de um livro, um por vez)
// Cada botão "Garimpar" baixa um .txt com os dados do livro
// (lidos dos atributos data-* do HTML) e do cliente logado
// ============================================================

// Pega TODOS os botões com class="btngarimpo".
// Em páginas sem esses botões, devolve uma lista vazia (não dá erro),
// então o forEach lá embaixo simplesmente não faz nada.
const botoesGarimpar = document.querySelectorAll(".btngarimpo");

// Transforma um título em texto seguro para nome de arquivo
// Exemplo: "A Hora da Estrela" -> "a-hora-da-estrela"
function criarSlug(texto) {
    return texto
        .normalize("NFD")                 // separa as letras dos acentos
        .replace(/[\u0300-\u036f]/g, "")  // remove os acentos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")      // tudo que não é letra/número vira "-"
        .replace(/^-+|-+$/g, "");         // tira "-" do começo e do fim
}

// Devolve o cadastro COMPLETO de quem está logado (ou null se ninguém logou).
// O login guarda só nome e e-mail no sessionStorage; o resto (CPF, endereço)
// vem da lista de usuários do localStorage, achada pelo e-mail.
function lerClienteLogado() {
    try {
        const texto = sessionStorage.getItem("usuarioLogado");
        if (!texto) return null;
        const logado = JSON.parse(texto);
        return lerUsuarios().find(u => u.email === logado.email) || null;
    } catch (erro) {
        console.error("Não foi possível ler o usuário logado:", erro);
        return null;
    }
}

// Trava todos os botões por um tempo, para garantir um livro por vez
// e evitar que o navegador bloqueie vários downloads seguidos
function travarBotoes(milissegundos) {
    botoesGarimpar.forEach(function (botao) {
        botao.disabled = true;
    });
    setTimeout(function () {
        botoesGarimpar.forEach(function (botao) {
            botao.disabled = false;
        });
    }, milissegundos);
}

botoesGarimpar.forEach(function (botao) {
    botao.addEventListener("click", function () {

        // 1) Acha a "div" do livro a que este botão pertence
        const livroEl = botao.closest(".livrosgarimpo");
        if (!livroEl) return;

        // 2) Precisa ter alguém logado para garimpar
        const cliente = lerClienteLogado();
        if (!cliente) {
            alert("Faça login para garimpar um livro.");
            window.location.href = "login.html";
            return;
        }

        // 3) Lê os dados do livro (atributos data-* da div)
        const titulo = livroEl.dataset.titulo;
        const autor = livroEl.dataset.autor;
        const genero = livroEl.dataset.genero;
        const preco = Number(livroEl.dataset.preco); // vem como texto, vira número

        if (!titulo || Number.isNaN(preco)) {
            console.error("Livro com data-* faltando ou inválido:", livroEl);
            alert("Não foi possível ler os dados deste livro.");
            return;
        }

        // Preço no formato brasileiro: R$ 24,90
        const precoFormatado = preco.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        // 4) Monta o comprovante (senha, sal e hash NÃO entram no arquivo)
        const conteudo =
`KOSHO - SEBO LITERÁRIO
Comprovante de garimpo
------------------------------
Pedido: ${Date.now()}
Data: ${new Date().toLocaleString("pt-BR")}

LIVRO
Título: ${titulo}
Autor: ${autor || "-"}
Gênero: ${genero || "-"}
Preço: ${precoFormatado}

CLIENTE
Nome: ${cliente.nome}
E-mail: ${cliente.email}
CPF: ${cliente.cpf}
Endereço: ${cliente.endereco}
`;

        // 5) Baixa o .txt, com um nome diferente para cada livro
        baixarTxt(conteudo, "garimpo-" + criarSlug(titulo) + ".txt");

        // 6) Trava os botões por 1,5s (um livro por vez)
        travarBotoes(1500);

        alert('Livro garimpado! O comprovante de "' + titulo + '" foi baixado.');
    });
});

// ============================================================
// PARTE 6: CADASTRO DE LIVRO (seção "Tem um livro parado na estante?")
// Só roda se a página tiver o formulário id="form-livro" (kosho.html).
// Ao enviar, mostra uma mensagem de sucesso por alguns segundos e
// limpa os campos.
// ============================================================

const formLivro = document.getElementById("form-livro");

if (formLivro) {
    const campoTituloLivro = document.getElementById("titulo-exemplar");
    const campoISBN = document.getElementById("ISBN");
    const msgLivro = document.getElementById("msg-livro");

    // Guarda o "cronômetro" que esconde a mensagem, para poder reiniciá-lo
    // se a pessoa cadastrar outro livro antes dos 5 segundos acabarem
    let temporizadorMsgLivro;

    // ISBN: aceita só números (e a letra X, que pode aparecer no ISBN de 10 dígitos)
    if (campoISBN) {
        campoISBN.addEventListener("input", () => {
            campoISBN.value = campoISBN.value.replace(/[^\dXx]/g, "");
        });
    }

    // Mostra o texto na mensagem e esconde de novo depois de 5 segundos
    function mostrarMensagemLivro(texto) {
        if (!msgLivro) return;

        msgLivro.textContent = texto;
        msgLivro.hidden = false; // tira o atributo "hidden" e a mensagem aparece

        // No celular o botão fica perto do fim da tela: garante que a mensagem apareça
        msgLivro.scrollIntoView({ behavior: "smooth", block: "nearest" });

        clearTimeout(temporizadorMsgLivro);
        temporizadorMsgLivro = setTimeout(() => {
            msgLivro.hidden = true;
        }, 5000);
    }

    formLivro.addEventListener("submit", (evento) => {
        evento.preventDefault(); // impede a página de recarregar

        // Os campos têm "required", então o navegador já bloqueia o envio
        // com campo vazio. O trim() abaixo pega o caso de só espaços.
        const titulo = campoTituloLivro.value.trim();
        if (!titulo) {
            alert("Digite o título do exemplar.");
            return;
        }

        mostrarMensagemLivro('Livro "' + titulo + '" cadastrado com sucesso!');

        formLivro.reset(); // limpa os campos para um próximo cadastro
    });
}