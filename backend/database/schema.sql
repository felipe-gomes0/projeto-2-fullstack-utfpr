DROP TABLE IF EXISTS lancamentos;
DROP TABLE IF EXISTS fontes_destinos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL CHECK (length(trim(nome)) >= 2),
    email       VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email)),
    cpf         CHAR(11)     NOT NULL UNIQUE CHECK (cpf ~ '^[0-9]{11}$'),
    senha_hash  TEXT         NOT NULL,
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE categorias (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome        VARCHAR(60) NOT NULL CHECK (length(trim(nome)) >= 1),
    tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, usuario_id)
);
CREATE UNIQUE INDEX categorias_usuario_tipo_nome_uk
    ON categorias (usuario_id, tipo, lower(nome));

CREATE TABLE fontes_destinos (
    id               SERIAL PRIMARY KEY,
    usuario_id       INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome             VARCHAR(60) NOT NULL CHECK (length(trim(nome)) >= 1),
    tipo             VARCHAR(20) NOT NULL CHECK (tipo IN ('renda', 'conta', 'cartao_credito')),
    dia_fechamento   SMALLINT    CHECK (dia_fechamento BETWEEN 1 AND 31),
    dia_vencimento   SMALLINT    CHECK (dia_vencimento BETWEEN 1 AND 31),
    limite_centavos  BIGINT      CHECK (limite_centavos >= 0),
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, usuario_id),
    CHECK (
        tipo <> 'cartao_credito'
        OR (dia_fechamento IS NOT NULL AND dia_vencimento IS NOT NULL AND limite_centavos IS NOT NULL)
    )
);
CREATE UNIQUE INDEX fontes_destinos_usuario_nome_uk
    ON fontes_destinos (usuario_id, lower(nome));

CREATE TABLE lancamentos (
    id                   SERIAL PRIMARY KEY,
    usuario_id           INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo                 VARCHAR(10)  NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    descricao            VARCHAR(200) NOT NULL CHECK (length(trim(descricao)) >= 1),
    valor_centavos       BIGINT       NOT NULL CHECK (valor_centavos > 0),
    data                 DATE         NOT NULL,
    data_compra          DATE         NOT NULL,
    categoria_id         INTEGER      NOT NULL,
    fonte_destino_id     INTEGER      NOT NULL,
    grupo_parcelamento   UUID,
    parcela_atual        SMALLINT     NOT NULL DEFAULT 1,
    total_parcelas       SMALLINT     NOT NULL DEFAULT 1,
    criado_em            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    FOREIGN KEY (categoria_id, usuario_id)
        REFERENCES categorias (id, usuario_id) ON DELETE RESTRICT,
    FOREIGN KEY (fonte_destino_id, usuario_id)
        REFERENCES fontes_destinos (id, usuario_id) ON DELETE RESTRICT,
    CHECK (total_parcelas BETWEEN 1 AND 48),
    CHECK (parcela_atual BETWEEN 1 AND total_parcelas),
    CHECK ((total_parcelas = 1) OR (grupo_parcelamento IS NOT NULL))
);

CREATE INDEX lancamentos_usuario_data_idx ON lancamentos (usuario_id, data);
CREATE INDEX lancamentos_categoria_idx    ON lancamentos (categoria_id);
CREATE INDEX lancamentos_fonte_idx        ON lancamentos (fonte_destino_id);
CREATE INDEX lancamentos_grupo_idx        ON lancamentos (grupo_parcelamento);
