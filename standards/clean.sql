-- =====================================================================
-- DANGER: DATABASE CLEANUP SCRIPT
-- =====================================================================
-- WARNING: This script will DROP ALL TABLES in the current database!
-- This is IRREVERSIBLE and will permanently delete all data!
-- 
-- USE WITH EXTREME CAUTION!
--
-- Safety Requirements:
-- 1. This script should only be run in development environments
-- 2. Ensure you have a backup if needed
-- 3. Verify the database name before executing
-- 4. Consider using transactions where possible
-- =====================================================================

-- Safety Check 1: Verify we're not running against production databases
SET @currentDb = DATABASE();
SELECT CONCAT('⚠️  WARNING: About to drop all tables in database: ', @currentDb) AS WARNING_MESSAGE;

-- Safety Check 2: Prevent execution on common production database names
-- Add your production database names to this list
SET @productionDbs = 'production,prod,live,main,master,public';
IF FIND_IN_SET(@currentDb, @productionDbs) > 0 THEN
    SELECT 'ERROR: This script cannot be run on production databases!' AS ERROR_MESSAGE;
    -- Force an error to stop execution
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Safety check failed: Production database detected';
END IF;

-- Safety Check 3: Require explicit confirmation
-- Uncomment the following lines and set @CONFIRM_DESTRUCTION = 'YES' to proceed
SET @CONFIRM_DESTRUCTION = 'NO';
IF @CONFIRM_DESTRUCTION != 'YES' THEN
    SELECT 'ERROR: You must explicitly confirm destruction by setting @CONFIRM_DESTRUCTION = ''YES''' AS ERROR_MESSAGE;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Safety check failed: Destruction not confirmed';
END IF;

-- Safety Check 4: Log what we're about to do
SELECT 
    TABLE_NAME as 'Tables that will be DROPPED',
    TABLE_ROWS as 'Estimated Rows (will be LOST)',
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as 'Size MB (will be LOST)'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = @currentDb
ORDER BY TABLE_NAME;

-- Step 1: Create a procedure to safely drop all foreign key constraints
DELIMITER $$

DROP PROCEDURE IF EXISTS SafeDropAllForeignKeys $$

CREATE PROCEDURE SafeDropAllForeignKeys()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE tableName VARCHAR(255);
    DECLARE fkName VARCHAR(255);
    DECLARE alterStatement VARCHAR(1024);
    DECLARE constraintCount INT DEFAULT 0;
    DECLARE errorCount INT DEFAULT 0;
    
    DECLARE cur CURSOR FOR
        SELECT TABLE_NAME, CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE();

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION 
    BEGIN
        SET errorCount = errorCount + 1;
        GET DIAGNOSTICS CONDITION 1
            @sqlstate = RETURNED_SQLSTATE, 
            @errno = MYSQL_ERRNO, 
            @text = MESSAGE_TEXT;
        SELECT CONCAT('Error dropping FK ', fkName, ' from ', tableName, ': ', @text) AS ERROR_LOG;
    END;

    -- Count total constraints
    SELECT COUNT(*) INTO constraintCount
    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE();
    
    SELECT CONCAT('Starting to drop ', constraintCount, ' foreign key constraints...') AS INFO_MESSAGE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO tableName, fkName;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET @alterStatement = CONCAT('ALTER TABLE `', tableName, '` DROP FOREIGN KEY `', fkName, '`;');
        
        -- Log the operation
        SELECT CONCAT('Dropping FK: ', fkName, ' from table: ', tableName) AS DROP_FK_LOG;
        
        PREPARE stmt FROM @alterStatement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END LOOP;

    CLOSE cur;
    
    -- Report results
    SELECT CONCAT('Dropped foreign key constraints. Errors encountered: ', errorCount) AS COMPLETION_REPORT;
END $$

DELIMITER ;

-- Step 2: Create a procedure to safely drop all tables
DELIMITER $$

DROP PROCEDURE IF EXISTS SafeDropAllTables $$

CREATE PROCEDURE SafeDropAllTables()
BEGIN
    DECLARE tableCount INT DEFAULT 0;
    DECLARE errorCount INT DEFAULT 0;
    
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION 
    BEGIN
        SET errorCount = errorCount + 1;
        GET DIAGNOSTICS CONDITION 1
            @sqlstate = RETURNED_SQLSTATE, 
            @errno = MYSQL_ERRNO, 
            @text = MESSAGE_TEXT;
        SELECT CONCAT('Error dropping tables: ', @text) AS ERROR_LOG;
    END;
    
    -- Count tables
    SELECT COUNT(*) INTO tableCount
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    AND table_type = 'BASE TABLE';
    
    SELECT CONCAT('Starting to drop ', tableCount, ' tables...') AS INFO_MESSAGE;
    
    -- Build and execute drop statement
    SET @tables = NULL;
    SELECT GROUP_CONCAT('`', table_name, '`') INTO @tables
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    AND table_type = 'BASE TABLE';  -- Only drop actual tables, not views

    IF @tables IS NOT NULL THEN
        SET @dropStatement = CONCAT('DROP TABLE IF EXISTS ', @tables);
        SELECT CONCAT('Executing: ', @dropStatement) AS DROP_STATEMENT_LOG;
        
        PREPARE stmt FROM @dropStatement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        SELECT 'All tables have been dropped successfully!' AS SUCCESS_MESSAGE;
    ELSE
        SELECT 'No tables found to drop.' AS INFO_MESSAGE;
    END IF;
    
    -- Final report
    SELECT CONCAT('Table drop operation completed. Errors encountered: ', errorCount) AS COMPLETION_REPORT;
END $$

DELIMITER ;

-- =====================================================================
-- EXECUTION SECTION
-- =====================================================================
-- WARNING: This will permanently delete all data!
-- To execute, you must:
-- 1. Set @CONFIRM_DESTRUCTION = 'YES' above
-- 2. Uncomment the transaction block below
-- 3. Review the operations one more time

-- Execute within a transaction for additional safety
-- START TRANSACTION;

-- Step 1: Drop all foreign key constraints
-- CALL SafeDropAllForeignKeys();

-- Step 2: Drop all tables  
-- CALL SafeDropAllTables();

-- Step 3: Clean up procedures
-- DROP PROCEDURE IF EXISTS SafeDropAllForeignKeys;
-- DROP PROCEDURE IF EXISTS SafeDropAllTables;

-- Commit the changes (or ROLLBACK if you change your mind)
-- COMMIT;

-- =====================================================================
-- FINAL SAFETY MESSAGE
-- =====================================================================
SELECT '⚠️  SAFETY NOTICE: Cleanup procedures created but NOT executed.' AS SAFETY_NOTICE;
SELECT 'To execute cleanup, uncomment the CALL statements above.' AS INSTRUCTION;
SELECT 'Remember: This operation is IRREVERSIBLE!' AS FINAL_WARNING;
