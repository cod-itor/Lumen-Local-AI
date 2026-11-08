package com.learnai.mapper;

import com.learnai.dto.response.SettingsDto;
import com.learnai.dto.response.UserDto;
import com.learnai.entity.User;
import com.learnai.entity.UserSettings;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.UUID;

@Mapper(componentModel = "spring")
public interface UserMapper {

    UserDto toDto(User user);

    @Mapping(target = "temperature", expression = "java(s.getTemperature() == null ? null : s.getTemperature().doubleValue())")
    @Mapping(target = "guardProfile", expression = "java(s.getGuardProfile().name())")
    @Mapping(target = "defaultProviderId", source = "defaultProviderId")
    SettingsDto toDto(UserSettings s, UUID defaultProviderId);
}
