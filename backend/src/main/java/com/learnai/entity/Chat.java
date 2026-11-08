package com.learnai.entity;

import com.learnai.entity.enums.Tab;
import com.learnai.entity.enums.TitleSource;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "chats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chat {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 4)
    private Tab tab;

    @Column(nullable = false, length = 80)
    @Builder.Default
    private String title = "New chat";

    @Enumerated(EnumType.STRING)
    @Column(name = "title_source", nullable = false, length = 8)
    @Builder.Default
    private TitleSource titleSource = TitleSource.DEFAULT;

    @Column(name = "active_leaf_id")
    private UUID activeLeafId;

    @Column(nullable = false)
    @Builder.Default
    private boolean pinned = false;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "last_message_preview", length = 120)
    private String lastMessagePreview;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** DOCS tab: the documents this chat may search (table chat_documents). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "chat_documents", joinColumns = @JoinColumn(name = "chat_id"))
    @Column(name = "document_id")
    @Builder.Default
    private Set<UUID> documentIds = new LinkedHashSet<>();

    /** Set explicitly: a chat moves to the top only when a message is added or it is renamed. */
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
