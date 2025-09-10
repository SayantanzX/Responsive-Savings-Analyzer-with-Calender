-- Oracle PL/SQL Schema for Savings Calendar
-- Run this script in your Oracle database

-- Create tablespace (if needed)
-- CREATE TABLESPACE savings_ts
-- DATAFILE 'savings_data.dbf' SIZE 100M
-- AUTOEXTEND ON NEXT 10M MAXSIZE 1G;

-- Create user (if needed)
-- CREATE USER savings_user IDENTIFIED BY your_password
-- DEFAULT TABLESPACE savings_ts
-- QUOTA UNLIMITED ON savings_ts;
-- GRANT CONNECT, RESOURCE TO savings_user;
-- GRANT CREATE VIEW, CREATE PROCEDURE, CREATE SEQUENCE TO savings_user;

-- Create sequences for auto-incrementing IDs
CREATE SEQUENCE users_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE savings_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE system_settings_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE system_logs_seq START WITH 1 INCREMENT BY 1;

-- Create users table
CREATE TABLE users (
    id NUMBER PRIMARY KEY,
    email VARCHAR2(255) UNIQUE NOT NULL,
    name VARCHAR2(255) NOT NULL,
    picture CLOB,
    password_hash VARCHAR2(255),
    google_id VARCHAR2(255) UNIQUE,
    role VARCHAR2(32) DEFAULT 'user' NOT NULL,
    is_active NUMBER(1) DEFAULT 1 NOT NULL,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create savings table
CREATE TABLE savings (
    id NUMBER PRIMARY KEY,
    user_id NUMBER NOT NULL,
    date TIMESTAMP NOT NULL,
    amount NUMBER(10, 2) NOT NULL,
    description CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_savings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create system_settings table
CREATE TABLE system_settings (
    id NUMBER PRIMARY KEY,
    site_name VARCHAR2(255),
    allow_signups NUMBER(1) DEFAULT 1,
    token_expiry_minutes NUMBER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create system_logs table
CREATE TABLE system_logs (
    id NUMBER PRIMARY KEY,
    level VARCHAR2(16) DEFAULT 'INFO',
    message CLOB NOT NULL,
    meta CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_savings_user_id ON savings(user_id);
CREATE INDEX idx_savings_date ON savings(date);
CREATE INDEX idx_savings_user_date ON savings(user_id, date);
CREATE INDEX idx_savings_amount ON savings(amount);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);

-- Create triggers for auto-incrementing IDs
CREATE OR REPLACE TRIGGER users_trigger
    BEFORE INSERT ON users
    FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        :NEW.id := users_seq.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER savings_trigger
    BEFORE INSERT ON savings
    FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        :NEW.id := savings_seq.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER system_settings_trigger
    BEFORE INSERT ON system_settings
    FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        :NEW.id := system_settings_seq.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER system_logs_trigger
    BEFORE INSERT ON system_logs
    FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        :NEW.id := system_logs_seq.NEXTVAL;
    END IF;
END;
/

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE TRIGGER users_update_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER savings_update_trigger
    BEFORE UPDATE ON savings
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER system_settings_update_trigger
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Create stored procedures for common operations
CREATE OR REPLACE PROCEDURE get_user_by_email(
    p_email IN VARCHAR2,
    p_user OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_user FOR
    SELECT id, email, name, picture, password_hash, google_id, role, is_active, 
           last_login, created_at, updated_at
    FROM users 
    WHERE email = p_email;
END;
/

CREATE OR REPLACE PROCEDURE get_user_by_id(
    p_id IN NUMBER,
    p_user OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_user FOR
    SELECT id, email, name, picture, password_hash, google_id, role, is_active, 
           last_login, created_at, updated_at
    FROM users 
    WHERE id = p_id;
END;
/

CREATE OR REPLACE PROCEDURE get_user_savings(
    p_user_id IN NUMBER,
    p_savings OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_savings FOR
    SELECT id, user_id, date, amount, description, created_at, updated_at
    FROM savings 
    WHERE user_id = p_user_id
    ORDER BY date DESC;
END;
/

CREATE OR REPLACE PROCEDURE get_analytics_data(
    p_total_users OUT NUMBER,
    p_total_savings_entries OUT NUMBER,
    p_total_savings_amount OUT NUMBER,
    p_average_per_entry OUT NUMBER
) AS
BEGIN
    SELECT COUNT(*) INTO p_total_users FROM users;
    
    SELECT COUNT(*) INTO p_total_savings_entries FROM savings;
    
    SELECT NVL(SUM(amount), 0) INTO p_total_savings_amount FROM savings;
    
    IF p_total_savings_entries > 0 THEN
        p_average_per_entry := p_total_savings_amount / p_total_savings_entries;
    ELSE
        p_average_per_entry := 0;
    END IF;
END;
/

-- Insert default system settings
INSERT INTO system_settings (id, site_name, allow_signups, token_expiry_minutes)
VALUES (system_settings_seq.NEXTVAL, 'Savings Calendar', 1, 30);

COMMIT;

-- Grant necessary permissions
-- GRANT SELECT, INSERT, UPDATE, DELETE ON users TO savings_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON savings TO savings_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON system_settings TO savings_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON system_logs TO savings_user;
-- GRANT EXECUTE ON get_user_by_email TO savings_user;
-- GRANT EXECUTE ON get_user_by_id TO savings_user;
-- GRANT EXECUTE ON get_user_savings TO savings_user;
-- GRANT EXECUTE ON get_analytics_data TO savings_user;
