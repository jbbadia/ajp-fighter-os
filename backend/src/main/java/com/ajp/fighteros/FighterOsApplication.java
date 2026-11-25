package com.ajp.fighteros;

import com.ajp.fighteros.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

// Users authenticate with JWT (auth package); Spring's default in-memory user is not needed.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableConfigurationProperties(AppProperties.class)
public class FighterOsApplication {

    public static void main(String[] args) {
        SpringApplication.run(FighterOsApplication.class, args);
    }
}
