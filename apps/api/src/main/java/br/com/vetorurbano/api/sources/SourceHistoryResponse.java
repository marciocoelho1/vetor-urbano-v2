package br.com.vetorurbano.api.sources;

import java.util.List;

public record SourceHistoryResponse(String sourceId, List<SourceDetails> versions) {}
