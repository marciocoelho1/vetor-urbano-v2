-- UXH-20: coleta de feedback do piloto. Sem listagem nesta entrega: o ticket pede coleta,
-- não painel. `account_id` nulo identifica visitante; nenhuma captura automática de
-- sessão, localização ou imagem é armazenada aqui.
CREATE TABLE pilot_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  account_id    uuid NULL REFERENCES local_accounts(id),
  route         text NOT NULL,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message       text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  contact_opt_in boolean NOT NULL DEFAULT false
);

CREATE INDEX pilot_feedback_created_at_idx ON pilot_feedback (created_at DESC);
