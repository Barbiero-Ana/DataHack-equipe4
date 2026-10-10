# Inconsistências dos dados

## 1. Erro numérico no CPC 2022

- **Local:** `cpc_2022.xlsx`, linha 250, curso `1517`, IES `18`, município `4314407` (fora de MT).
- **Inconsistência:** valor `#NÚM!` na proporção de concluintes participantes com nota no Enem, em lugar de um número.
- **Impacto:** impede converter a medida para número; substituição por zero produziria um resultado falso.
- **Estado:** original preservado em `_ORIGINAL_PROPORCAO_DE_CONCLUINTES_PARTICIPANTES_COM_NOTA_NO_ENEM`; medida nula e erro registrado no manifest. O valor correto não foi reconstruído.

## 2. Representação não uniforme dos enums na trajetória

- **Local:** `indicadores_trajetoria_educacao_superior_2015_2024.xlsx`, campos de modalidade e categoria administrativa.
- **Inconsistência de representação:** o mesmo código aparece como `1` e `1.0`, entre outros códigos inteiros com decimal nulo.
- **Impacto:** filtros textuais por `1` deixam de encontrar registros representados como `1.0`.
- **Estado:** decimal nulo removido dos enums no staging, mantendo o significado do código e os originais intactos. Filtro presencial final de MT encontra 515 cursos após a normalização.

## 3. Caracteres invisíveis em categorias administrativas

- **Local:** `conceito_enade_licenciaturas.xlsx`, campo de categoria administrativa.
- **Inconsistência de representação:** textos como `Privada sem fins lucrativos` também aparecem com caractere de largura zero (`U+200B`) no final.
- **Impacto:** textos visualmente iguais podem ser tratados como categorias diferentes por igualdade, agrupamento e filtro.
- **Estado:** caracteres de largura zero e espaços externos removidos no staging; valores originais permanecem no arquivo de origem.
