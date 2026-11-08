package com.learnai.harness.task;

import com.learnai.entity.enums.Task;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class TaskHandlers {

    private final Map<Task, TaskHandler> byTask = new EnumMap<>(Task.class);

    public TaskHandlers(List<TaskHandler> handlers) {
        handlers.forEach(h -> byTask.put(h.task(), h));
    }

    public Optional<TaskHandler> get(Task task) {
        return Optional.ofNullable(byTask.get(task));
    }
}
